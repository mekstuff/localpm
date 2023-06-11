
export type extractedPackageInfo = {
  Package: string,
  Orginization: string,
  Name: string,
  Version: string,
  Path: string,
  // WithOrginization: string
}


//Source parse-package-name

// Parsed a scoped package name into name, version, and path.
const RE_SCOPED = /^(@[^\/]+\/[^@\/]+)(?:@([^\/]+))?(\/.*)?$/
// Parsed a non-scoped package name into name, version, path
const RE_NON_SCOPED = /^([^@\/]+)(?:@([^\/]+))?(\/.*)?$/

export default function(input: string):extractedPackageInfo {
  const m = RE_SCOPED.exec(input) || RE_NON_SCOPED.exec(input)

  if (!m) {
    throw new Error(`[parse-package-name] invalid package name: ${input}`)
  }
  
  let orginization:string;
  let pkg:string;
  const orginizationSplitter = m[1].split("/")
  if(orginizationSplitter.length > 1){
    orginization = orginizationSplitter[0];
    pkg = orginizationSplitter[1];
  }else{
    pkg = m[1] || ""
  }

  return {
    Package: pkg,
    Orginization: orginization,
    Name: m[1] || '',
    Version: m[2] || 'latest',
    Path: m[3] || '',
    // WithOrginization: `${orginization || "@"}/${m[1]}`
  }
}


// export default function(x:string){
//     let orginization:string|undefined;
//     let package_:string|undefined;
//     let version:string|undefined;
//     const split = x.split("@");
//     if(split.length == 3){
//         //contains orginization, @lanzo/package@ver
//         version = split[2];
//         const _splitName = split[1].split("/");
//         orginization = "@"+_splitName[0];package_ = _splitName[1];
//     }else{
//         if(split[0] == ""){
//         //@orginization/package
//         const _splitName = split[1].split("/");
//         orginization = _splitName[0];package_ = _splitName[1];
//         }else{
//         //package@ver
//         package_ = split[0];version = split[1];
//         }
//     };
//     return {
//         Orginization: orginization,
//         Package: package_,
//         Version: version
//     }
//     // return [orginization,package_,version]
// };