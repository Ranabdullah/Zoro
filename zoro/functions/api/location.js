export function onRequestGet({request}) {
  const cf=request.cf||{};
  return Response.json({location:[cf.city,cf.region,cf.country].filter(Boolean).join(", ").slice(0,160)||"Unavailable"},{headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
}
