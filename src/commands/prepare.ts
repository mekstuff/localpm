import fs from "fs";
import path from "path";

import { program as CommanderProgram } from "commander";

interface prepareactionoptions {
    prod?: boolean,
    dev?: boolean,
}

export default function (program: typeof CommanderProgram){
    program.command("prepare")
    .option("--prod", "Prepare the package for production, will go through all dependencies that are local dependencies and use the current version", false)
    .option("--dev", "Should be called after prepared --prod, will switch back to using local dependency links", false)
    .action(async  (options:prepareactionoptions) => {
        if(!options.prod && !options.dev){
            console.log("Did not set --prod or --dev flag, command will not run.")
            process.exit(1);
        }
        if(options.prod && options.dev){
            console.log("Cannot set --prod and --dev flag at the same time.")
            process.exit(1);
        }
        if(!fs.existsSync(path.join(process.cwd(),"localpm.lock"))){
            console.log(`No localpm.lock was found in directory ${process.cwd()}`);
            process.exit(0);
        }
        const LocalpmLock = fs.readFileSync(path.join(process.cwd(),"localpm.lock"));

        const package_ = fs.readFileSync(path.join(process.cwd(),"package.json"));
        if(!package_){
            console.log(`No package.json was found in directory ${process.cwd()}`);
            process.exit(1);
        }
        const packageJSON = JSON.parse(package_.toString());
        const PMJSON = JSON.parse(LocalpmLock.toString());
        packageJSON.dependencies = packageJSON.dependencies || {};

        for(const pn in PMJSON.packages){
            if(options.prod){
                const resolveItemPackageJSON = fs.readFileSync(path.join(PMJSON.packages[pn].resolve,"package.json"))
                let res = "*";
                if(resolveItemPackageJSON){
                    try{
                       res = resolveItemPackageJSON && JSON.parse(resolveItemPackageJSON.toString()).version;
                    }catch (e){
                        console.log(`Could not resolve package version for ${pn} => ${PMJSON.package[pn].resolve} Will use default "*".`);
                    }
                }
                packageJSON.dependencies[pn] = res
            }else{
                //regex \\ in windows since we want to return to the original resolve that the package manager used.
                packageJSON.dependencies[pn] = "link:"+(PMJSON.packages[pn].resolve.replace(/\\/g, "/"));
            }
            fs.writeFileSync(path.join(process.cwd(),"package.json"),JSON.stringify(packageJSON,null,2));
        }

    })
}