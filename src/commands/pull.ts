import fs from "fs";
import path from "path";

import { Listr } from "listr2";
import { program as CommanderProgram } from "commander";
import extractPackageName from "../misc/extractPackageName.js";
import { exec } from "child_process";

interface pullactionoptions {
    npm?: boolean,
    yarn?: boolean,
    pnpm?: boolean,
}

function getPackageManagerFromPath(Path:string):string|undefined {
    const yarnLock = fs.existsSync(path.join(Path,"yarn.lock"));
    if(yarnLock){
        return "yarn";
    }
    const npmlock = fs.existsSync(path.join(Path,"package-lock.json"));
    if(npmlock){
        return "npm";
    }
    const pnpmlock = fs.existsSync(path.join(Path,"pnpm-lock.yaml"));
    if(pnpmlock){
        return "pnpm";
    }
    return undefined;
}

export async function pullaction(packageName:string, packagePath:string,options?:pullactionoptions){
    options = options || {};
    const MT = new Listr(
        [
            {
                title: `Pulling package "${packageName}"...`,
                task: async (_,task) => {
                    const LOCK_PATH = path.join(packagePath,"localpm.lock")
                    const obj:any = JSON.parse(fs.readFileSync(LOCK_PATH).toString())

                    let pkginfo = extractPackageName(packageName);

                    const localpmPackageData = (obj.packages[pkginfo.Name])
                    if(!localpmPackageData){
                        throw new Error(`${packageName} is not managed by localpm. Could not find in lock file.`);
                    }
                    const previouspm = localpmPackageData.pm;
                    let targetpm: string|undefined;
                    if(!options.npm && !options.yarn && !options.pnpm){
                        targetpm = getPackageManagerFromPath(packagePath);
                    }else{
                        targetpm = options.npm && "npm" || options.yarn && "yarn" || options.pnpm && "pnpm";
                    }
 
                    //if no package manager is defined then prompt for one.
                    if(!targetpm){
                        if(previouspm){
                            targetpm = previouspm
                        } else {
                            targetpm = await task.prompt({
                                    message: "Select a package manager",
                                    type: "Select",
                                    // choices: ["yarn","npm","pnpm"] due to npm and pnpm not supporting dependencies that are with link: protocol
                                    choices: ["yarn"]
                                })
                            }
                    }

                    if(targetpm && targetpm !== "yarn"){
                        console.log("Due to npm and pnpm not supporting link: dependencies, the options were removed. Please switch to a yarn managed project.");
                        process.exit(1);
                    }

                    localpmPackageData.pm = targetpm;
                    await fs.promises.writeFile(path.join(packagePath,"localpm.lock"),JSON.stringify(obj,null,2),"utf8").catch(e=>{throw e});
                    
                    let prefix:string;
                    if(targetpm === "yarn"){
                        prefix = "yarn add link:"
                    }else if(targetpm === "npm"){
                        console.log("packages can only be managed by yarn.");
                        process.exit(1);
                        prefix = "npm install link:";
                    }else if(targetpm === "pnpm"){
                        console.log("packages can only be managed by yarn.");
                        process.exit(1);
                        prefix = "pnpm install link:";                        
                    }

                    const execCMD = prefix+localpmPackageData.resolve;
                    await new Promise<void>((resolve,reject) => {
                        const executedCommand = exec(execCMD,{cwd: packagePath})
                        executedCommand.stderr.on("data",(data:Buffer)=>{
                            console.log(data.toString())
                        })
                        executedCommand.on("close", (exitcode) => {
                        if(exitcode === 0){
                            resolve();
                        }else{
                            reject();
                        }
                    })
                })
                }
            }
        ]
    )
    await MT.run().catch(e=>{

    })
}

export default function pull(program: typeof CommanderProgram){
    program.command("pull [packageName]")
    .option("--yarn", "use yarn as the package manager", false)
    .option("--npm", "use npm as the package manager", false)
    .option("--pnpm", "use pnpm as the package manager", false)
    .action(async (packageName, options) => {
        if(packageName){
            pullaction(packageName,process.cwd(),options);
        }else{
            //loop through all packages and pull them
        }
    })
}