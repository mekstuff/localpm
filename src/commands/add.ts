import fs from "fs";
import extractPackageName, { extractedPackageInfo } from "../misc/extractPackageName.js";
import path from "path";
import { Listr } from "listr2";
import { addPathToInstallation } from "../misc/getPackageVersions.js";
import { getlocalpmPackageJsonPath, localpmPackages } from "../misc/createHomeFolder.js";
import { execSync } from "child_process";
import { program as CommanderProgram } from "commander"

type AddContext = {
    extractedInfo: extractedPackageInfo
}

interface addactionoptions {
    noPull?: boolean
}

export async function addaction(packagePath:string, packageName:string, options:addactionoptions){
    const MT = new Listr<AddContext>(
        [
            {
                title: "Validate Package.json",
                task: async () => {
                    const exists = fs.existsSync(path.join(packagePath,"package.json"));
                    if(!exists){
                        throw new Error(`Could not resolve package.json file in "${packagePath}"`);
                    }
                    const readPackageFile =  JSON.parse(await fs.promises.readFile(path.join(packagePath,"package.json"),"utf8").catch(e => {
                        throw new Error(`Could not read package.json file ${e}`);
                    }));
                    if(!readPackageFile.name){
                        throw new Error(`Package is missing the "name" field.`)
                    }
                }
            },
            {
                title: `Adding ${packageName}`,
                task: async (ctx,task) => {
                    const extractedInfo = extractPackageName(packageName);
                    ctx.extractedInfo = extractedInfo;
                    const JSONRead:localpmPackages = JSON.parse(fs.readFileSync(await getlocalpmPackageJsonPath(),"utf8"));
                    const targetPackage = JSONRead.packages[packageName];
                    if(!targetPackage){
                        console.log(`"${packageName}" was not found in local registry`);
                        task.skip();
                        return;
                    }

                    //add to localpm.lock
                    const LOCK_PATH = path.join(packagePath,"localpm.lock")
                    if(!fs.existsSync(LOCK_PATH)){
                        await fs.promises.writeFile(LOCK_PATH,JSON.stringify({"packages":{}},null,2)).catch(e=>{throw e;});
                    }
                    const obj:any = JSON.parse(fs.readFileSync(LOCK_PATH).toString())
                    obj.packages = obj.packages || {};
                    obj.packages[extractedInfo.Name] = {
                        resolve: path.resolve(targetPackage.resolve)
                    }
                    await fs.promises.writeFile(LOCK_PATH,JSON.stringify(obj,null,2)).catch(e=>{throw e;});
                    await addPathToInstallation(packagePath,extractedInfo.Name);
                }
            }                 
        ]
    )
    await MT.run().catch(e=>{

    }).then((f)=>{
        if(!options.noPull){
            try{
                execSync("lpm pull "+(f as unknown as AddContext).extractedInfo.Name,{cwd: packagePath, stdio: "inherit"});
            }catch(e){
                console.warn("Failed to execute lpm pull ==>> ", e)
            }
            // updateaction((f as unknown as AddContext).extractedInfo.Name, packagePath)
        }
    })
}

export default function add(program: typeof CommanderProgram){
    program.command("add <packageName...>")
    .option("--noPull", "Does not run the pull command, meaning it will not be installed via a package manager",false)
    .action(async (packageName:Array<string>, options) => {
        packageName.map(async (pn)=>{
            await addaction(process.cwd(),pn,options)
        })
        console.log(packageName);
    })
}