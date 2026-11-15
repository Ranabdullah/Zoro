// Compatibility only for pre-rename Cloudflare projects. New installs use /zoro.
import {execFileSync} from "node:child_process";
import {cpSync,rmSync} from "node:fs";
import {fileURLToPath} from "node:url";
import path from "node:path";
const root=fileURLToPath(new URL("./",import.meta.url));
const source=fileURLToPath(new URL("../zoro/",import.meta.url));
const output=path.resolve(root,"dist");
if(output!==path.join(path.resolve(root),"dist"))throw Error("Unexpected compatibility output directory.");
if(!process.env.npm_execpath)throw Error("Run this compatibility build through npm run build.");
for(const args of [["ci"],["run","build"]])execFileSync(process.execPath,[process.env.npm_execpath,...args],{cwd:source,stdio:"inherit"});
rmSync(output,{recursive:true,force:true});
cpSync(path.join(source,"dist"),output,{recursive:true});
