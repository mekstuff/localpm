import fs from "fs";
import { localpmPackages, getlocalpmPackageJsonPath } from "./createHomeFolder.js";

export async function removePathFromInstallation(targetpath:string,packageName:string,version:string){
    try{ //so errors for add is ignored
        return await addPathToInstallation(targetpath,packageName,version,true); 
    }catch(e){
        // console.log(e);
    }
}
export async function addPathToInstallation(targetpath:string,packageName:string,version:string,removePath?:boolean){
    return await getlocalpmPackageJsonPath().then(async (e) => {
        const JSONRead:localpmPackages = JSON.parse(fs.readFileSync(e,"utf8"));
        const targetPackage = JSONRead.packages[packageName];
        if(!targetPackage){
            throw new Error(`${packageName} was not found in localpm-packages.`);
        }
        const target = targetPackage[version];
        if(!target){
            throw new Error(`Version ${version} of ${packageName} is not published.`)
        }
        const exists = target.installations.find(_e=> _e === targetpath)
        if( (removePath && exists) || (!exists && !removePath) ){
            if(removePath){
                const index = target.installations.indexOf(targetpath);
                console.log(index);
                target.installations.splice(index,1);
            }else{
                target.installations.push(targetpath);
            }
            fs.promises.writeFile(await getlocalpmPackageJsonPath(), JSON.stringify(JSONRead,null,2)).catch(e=>{throw e});
        }
    })
}

export async function getPackageVersionData(packageName:string,version:string){
    return await getlocalpmPackageJsonPath().then(e => {
        const JSONRead:localpmPackages = JSON.parse(fs.readFileSync(e,"utf8"));
        const targetPackage = JSONRead.packages[packageName];
        if(!targetPackage){
            throw new Error(`${packageName} was not found in localpm-packages.`);
        }
        const target = targetPackage[version];
        if(!target){
            throw new Error(`Version ${version} of ${packageName} is not published.`)
        }
        return target;
    })
}

export default async function getPackageVersions(packageName:string):Promise<Array<string>|undefined>{
    return await getlocalpmPackageJsonPath().then(e => {
        const JSONRead:localpmPackages = JSON.parse(fs.readFileSync(e,"utf8"));
        const targetPackage = JSONRead.packages[packageName];
        if(!targetPackage){
            throw new Error(`${packageName} was not found in localpm-packages.`);
        }
        return (Object.keys(targetPackage))
    });
}