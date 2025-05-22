const fs = require('fs');
const path = require('path');
const vm = require('vm'); // Using Node.js vm module for safer script execution

const htmlFilePath = path.join(__dirname, 'test_page.html');
let listPageHtml = '';
try {
    listPageHtml = fs.readFileSync(htmlFilePath, 'utf8');
} catch (err) {
    console.error('Error reading test_page.html:', err.message);
    process.exit(1);
}

console.log(`Read ${htmlFilePath}, length: ${listPageHtml.length}`);

// Regex to capture the entire IIFE string assigned to window.__NUXT__
const nuxtScriptRegex = /<script>\s*window\.__NUXT__\s*=\s*([\s\S]+?)\s*;?\s*<\/script>/s;
const nuxtScriptMatch = listPageHtml.match(nuxtScriptRegex);

if (nuxtScriptMatch && nuxtScriptMatch[1]) {
    const iifeString = nuxtScriptMatch[1].trim();
    console.log("\n--- Captured IIFE String ---");
    // console.log("Full IIFE String (first 1000):", iifeString.substring(0, 1000) + "...");

    try {
        // Create a new script context to execute the IIFE
        // The IIFE is (function(params){...})(args);
        // We can execute this directly if it's well-formed JavaScript
        const nuxtData = vm.runInNewContext(iifeString);

        if (nuxtData && nuxtData.data && Array.isArray(nuxtData.data) && nuxtData.data[0] && nuxtData.data[0].postList) {
            const posts = nuxtData.data[0].postList;
            console.log(`\n--- SUCCESS: Extracted ${posts.length} posts using vm module ---`);
            // console.log("First post:", JSON.stringify(posts[0], null, 2));
        } else {
            console.error("\n--- ERROR: postList not found in executed nuxtData object ---");
            if (nuxtData && nuxtData.data && Array.isArray(nuxtData.data)) {
                console.log("nuxtData.data[0]:", nuxtData.data[0]);
            } else if (nuxtData) {
                console.log("nuxtData (keys):", Object.keys(nuxtData));
            } else {
                console.log("vm.runInNewContext returned:", nuxtData);
            }
        }
    } catch (e) {
        console.error("\n--- ERROR: Failed to execute or parse IIFE string with vm module ---");
        console.error("Error message:", e.message);
        console.log("IIFE String that caused error (first 1000 chars):", iifeString.substring(0, 1000) + "...");
    }

} else {
    console.log("\n--- ERROR: nuxtScriptRegex did not match (Could not find window.__NUXT__ script block) ---");
}
