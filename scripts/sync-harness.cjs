// Bundle the shared cockpit controls so standalone OWV does not require an iframe.
const fs=require('node:fs'),path=require('node:path');
const destination=path.join(__dirname,'../static/harness');
const source=process.env.OWV_COCKPIT_SOURCE || path.join(__dirname,'../../owv-cockpit');
fs.mkdirSync(destination,{recursive:true});
for(const name of ['harness-ui.js','commands-ui.js']) {
 const input=path.join(source,name),output=path.join(destination,name);
 if(fs.existsSync(input))fs.copyFileSync(input,output);
 else if(!fs.existsSync(output))throw new Error('Missing bundled cockpit control: '+name);
}
