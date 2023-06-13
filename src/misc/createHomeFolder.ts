import os from "os";
import path from "path";
import fs from "fs";

const DEFAULT_DIRECTORY = path.join(os.homedir(),".localpm");

const DEFAULT_JSON_TEMPLATE = {
    "packages": {},
    "build-version": "0",
}

function catchErr(e: { code: string; }){
    if(e.code !== "EEXIST"){
        throw e;
    }
}

export async function createlocalpmPackagesJsonFile(){
    const localpm_packages_json_path = path.join(DEFAULT_DIRECTORY,"localpm-packages.json")
    const exists = fs.existsSync(localpm_packages_json_path);
    if(exists){
        return;
    }
    await fs.promises.writeFile(path.join(localpm_packages_json_path), JSON.stringify(DEFAULT_JSON_TEMPLATE,null,2),"utf8").catch(e => {
        throw e;
    });
}

export interface localpmPackageData {
    installations: Array<string>,
    resolve: string,
}

export interface localpmPackages {
    packages: {[key: string]: {[key: string]: localpmPackageData}},
    ["build-version"]: string,
}

export async function getlocalpmPackageJsonPath(createOnNonExist?:boolean): Promise<string>{
    const localpm_packages_json_path = path.join(DEFAULT_DIRECTORY,"localpm-packages.json")
    const exists = fs.existsSync(localpm_packages_json_path);
    if(!exists){
        if(createOnNonExist){
            await createHomeFolder();
            // await createlocalpmPackagesJsonFile();
            return localpm_packages_json_path;
        }
        throw new Error("Could not find localpm-packages.json");
    }
    return localpm_packages_json_path;
}

export function getlocalpmDirectory(){
    return DEFAULT_DIRECTORY;
}

export function getlocalpmPkgs(){
    return path.join(getlocalpmDirectory(), "pkgs");
}

export default async function createHomeFolder(){
    await fs.promises.mkdir(getlocalpmDirectory()).catch(catchErr);
    await fs.promises.mkdir(getlocalpmPkgs()).catch(catchErr);
    await createlocalpmPackagesJsonFile();
}