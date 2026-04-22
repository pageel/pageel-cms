import fs from 'fs';
const base64Content = btoa(unescape(encodeURIComponent('{"plugins": {"editor": "@pageel/plugin-mdx"}}')));
console.log(base64Content);
