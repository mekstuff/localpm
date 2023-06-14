import fs from "fs";
import path from "path";
import { Listr } from "listr2";
import { program as CommanderProgram } from "commander";
import extractPackageName from "../misc/extractPackageName.js";
import { exec } from "child_process";
import { localpmPackages, getlocalpmPackageJsonPath } from "../misc/createHomeFolder.js";
import { removePathFromInstallation } from "../misc/getPackageVersions.js";

import { extractedPackageInfo } from "../misc/extractPackageName.js";

type removeactioncontext = {
    versionInLock: string,
    pm: "yarn"|"npm"|"pnpm",
    PackageInfo: extractedPackageInfo
}

type removeOptions = {
    yarn?: boolean,
    npm?: boolean,
    safe?: boolean,
}

export async function removeaction(packagePath:string, packageName:string, options?:removeOptions){
    const MT = new Listr<removeactioncontext>(
        [
            {
                title: "Verifying lock file",
                task: async (ctx) => {
                    const LOCK_PATH = path.join(packagePath,"localpm.lock")
                    if(!fs.existsSync(LOCK_PATH)){
                        throw new Error(`No localpm.lock file was found in packagePath ${packagePath}`)
                    }
                    const info = extractPackageName(packageName);
                    
                    ctx.PackageInfo = info;
                }
            },
            {
                title: "Removing from lock file",
                task: async (ctx,task) => {
                    const LOCK_FILE = JSON.parse(await fs.promises.readFile(path.join(packagePath,"localpm.lock"),"utf8").catch(e=>{throw e}));
                    const inLock = LOCK_FILE.packages[ctx.PackageInfo.Name];
                    ctx.pm = options.npm && "npm" || options.yarn && "yarn" || undefined;
                    if(inLock){
                        ctx.versionInLock = inLock.version
                    }
                    if(!inLock){
                        task.skip(`"${ctx.PackageInfo.Name}" Package was not found in localpm.lock file`);
                    }else{
                        if(!ctx.pm){
                            ctx.pm = inLock.pm;
                        }
                        LOCK_FILE.packages[ctx.PackageInfo.Name] = undefined;
                        await fs.promises.writeFile(path.join(packagePath,"localpm.lock"),JSON.stringify(LOCK_FILE,null,2)).catch(e=>{throw e})
                    }
                } 
            },
            {
                title: "Removing from package manager",
                task: async (ctx,task) => {
                    if(!ctx.pm){
                        task.skip(`Could not identify package manager that was used to install, you will need to manually remove "${ctx.PackageInfo.Name}"`)
                    }else{
                        task.output = "pm: "+ctx.pm
                        var prefix:string;
                        if(ctx.pm == "yarn"){
                            prefix = "yarn remove"
                        }else if(ctx.pm == "npm"){
                            prefix = "npm uninstall";
                        }else if(ctx.pm === "pnpm"){
                            prefix = "pnpm remove";
                        }

                        await new Promise<void>((resolve) => {
                            const execCMD = prefix+" "+ctx.PackageInfo.Name;
                            const executedCommand = exec(execCMD,{cwd: packagePath})
                            executedCommand.stderr.on("data",(data:Buffer)=>{
                                console.log(data.toString())
                            })
                            executedCommand.on("close", (exitcode) => {
                                if(exitcode === 0){
                                    resolve();
                                }else{
                                    task.title = `FAILED: "`+task.title + `" - Package manager exited with code other than 0.`
                                    resolve();
                                }
                            })
                        })

                    }
                } 
            },
            {
                title: "Removing from installations",
                task: async (ctx,task) => {
                    const localpmPackages = await getlocalpmPackageJsonPath();
                    const localpmPackagesJSON:localpmPackages = JSON.parse(await fs.promises.readFile(localpmPackages,"utf8").catch(e=>{throw e}));
                    const packageData = localpmPackagesJSON.packages[ctx.PackageInfo.Name];
                    if(packageData === undefined){
                        task.skip(`${ctx.PackageInfo.Name} was not found in the global localpm-packages.json file`);
                    }
                    removePathFromInstallation(packagePath,ctx.PackageInfo.Name,ctx.versionInLock)
                },
            },
        ],
        {
            exitOnError: options.safe && false || true,
        }
    )
    await MT.run().catch(e=>{
        if(!options.safe){
            throw e;
        }
    });
}

export default function remove(program:typeof CommanderProgram){
    program.command("remove <packageName...>")
    .option("--yarn")
    .option("--npm")
    .option("--safe", "Does not error if something fails")
    .action(async (packageName:Array<string>,options) => {
        packageName.map(async (pn)=>{
            await removeaction(process.cwd(),pn,options)
        })
        // await addaction(process.cwd(),pn,options)
    })
}