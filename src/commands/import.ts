import fs from "fs";
import path from "path";
import extractPackageName from "../misc/extractPackageName.js";
import { Listr } from "listr2";
import { program as CommanderProgram } from "commander";
import { execSync } from "child_process";
import { backupJson } from "../misc/backupJson.js";

async function importaction(packagePath:string, packageName:string, directory: string){
    const MT = new Listr(
        [
            {
                title: "Adding package",
                task: async () => {
                    try{
                        execSync("lpm add "+packageName+" --noPull",{cwd: packagePath, stdio: "inherit"});
                    }catch(e){
                        console.warn("Failed to add package with 'lpm add'");
                        console.warn(e);
                        process.exit(1);
                    }
                }
            },
            {
                title: `Importing ${packageName} (reminder: package must contain src/)`,
                task: async (_,task) => {
                    const LOCK_PATH = path.join(packagePath,"localpm.lock")
                    const obj:any = JSON.parse(fs.readFileSync(LOCK_PATH).toString())

                    let pkginfo = extractPackageName(packageName);

                    const localpmPackageData = (obj.packages[pkginfo.Name])
                    if(!localpmPackageData){
                        throw new Error(`${packageName} is not managed by localpm. Could not find in lock file.`);
                    }
                    if(!directory){
                        const defaultDirectory = "packages";
                        directory = await task.prompt({
                            type: "Input",
                            message: "Where should package be added?",
                            initial: defaultDirectory
                        })
                    }

                    if(packagePath === "node_modules"){
                        console.warn("You should not use node_modules for packages.")
                        process.exit(1);
                    }
                    const mustCreateDirectories = path.join(packagePath, directory, pkginfo.Orginization || undefined);

                    fs.mkdirSync(mustCreateDirectories, {recursive: true});
                    const restPath = path.join(mustCreateDirectories, pkginfo.Package);
                    fs.symlinkSync(path.join(localpmPackageData.resolve,"src"),restPath, "dir"); //symlink the src. we don't care about anything else
                    localpmPackageData.imported = restPath;
                    await fs.promises.writeFile(path.join(packagePath,"localpm.lock"),JSON.stringify(obj,null,2),"utf8").catch(e=>{throw e});

                }
            }                 
        ]
    )
    await backupJson();
    await MT.run().catch(e=>{

    })
}

export default function Import(program: typeof CommanderProgram){
    program.command("import <packageName> [directory]")
    .description("Instead of installing using a package manager and adding to node_modules, the local copy will be added to a specified directory")
    .action(async (packageName,directory)=>{
        await importaction(process.cwd(),packageName,directory)
    })
}