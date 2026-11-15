import { createClient } from "npm:@supabase/supabase-js@2.105.0";

Deno.serve(async request => {
  const origin=request.headers.get("Origin")||"";
  const origins=(Deno.env.get("APP_ORIGINS")||"").split(",").map(v=>v.trim());
  const headers={"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin","Cache-Control":"no-store"};
  if(!origin||!origins.includes(origin))return new Response("Origin not allowed",{status:403});
  if(request.method==="OPTIONS")return new Response(null,{headers});
  if(request.method!=="POST")return new Response("Method not allowed",{status:405,headers});
  const fail=(message:string,status=400)=>Response.json({error:message},{status,headers});
  try{
    const jwt=request.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
    if(!jwt)return fail("Sign in before recovering your account.",401);
    const url=Deno.env.get("SUPABASE_URL")!,key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if(!url||!key)return fail("Recovery is not configured.",503);
    const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data,error}=await admin.auth.getUser(jwt),user=data.user;
    if(error||!user||(!user.email_confirmed_at&&!user.phone_confirmed_at))return fail("Verified sign-in required.",401);
    if(Number(request.headers.get("Content-Length")||0)>4096)return fail("Invalid request.");
    const body=await request.json();
    if(typeof body.code!=="string"||!/^[a-f0-9]{32}$/i.test(body.code.trim()))return fail("Recovery code was not accepted.");
    const result=await admin.rpc("zoro_consume_recovery_code",{actor:user.id,recovery_code:body.code});
    if(result.error||result.data!==true)return fail("Recovery code was not accepted. Too many attempts require a one-hour wait.",403);
    const factors=await admin.auth.admin.mfa.listFactors({userId:user.id});
    if(factors.error)return fail("Recovery paused. Contact the project owner; this code has been consumed.",503);
    for(const factor of factors.data.factors){const deleted=await admin.auth.admin.mfa.deleteFactor({userId:user.id,id:factor.id});if(deleted.error)return fail("Recovery paused. Contact the project owner; this code has been consumed.",503);}
    const cleared=await admin.rpc("zoro_finish_account_recovery",{actor:user.id});
    if(cleared.error)return fail("Factor recovery completed but browser approval reset failed. Contact the project owner.",503);
    const signedOut=await admin.auth.admin.signOut(jwt,"global");
    if(signedOut.error)return fail("Recovery changed your factors, but session revocation needs the project owner's review.",503);
    return Response.json({ok:true,message:"All factors and browser approvals reset; recovery codes invalidated. Sign in again and enroll a new authenticator."},{headers});
  }catch{return fail("Recovery could not be completed. Try later or contact the project owner.",503);}
});
