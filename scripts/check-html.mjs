import fs from 'node:fs';import vm from 'node:vm';
const h=fs.readFileSync('public/index.html','utf8');
const blocks=[];let pos=0;while(true){const a=h.indexOf('<script>',pos);if(a<0)break;const b=h.indexOf('</script>',a+8);if(b<0)throw new Error('UNCLOSED_SCRIPT');blocks.push(h.slice(a+8,b));pos=b+9}
if(!blocks.length)throw new Error('NO_INLINE_SCRIPT');
for(const [i,s] of blocks.entries())new vm.Script(s,{filename:'public/index.html#script-'+i});
let n=0,p=0;while((p=h.indexOf('</html>',p))>=0){n++;p+=7}if(n!==1)throw new Error('HTML_DOCUMENT_DUPLICATED');
console.log(JSON.stringify({event:'HTML_SCRIPT_GATE_PASS',scripts:blocks.length}));
