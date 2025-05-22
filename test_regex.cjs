const fs = require('fs');
const path = require('path');

const htmlFilePath = path.join(__dirname, 'test_page.html');
let listPageHtml = '';
try {
    listPageHtml = fs.readFileSync(htmlFilePath, 'utf8');
} catch (err) {
    console.error('Error reading test_page.html:', err.message);
    process.exit(1);
}

console.log(`Read ${htmlFilePath}, length: ${listPageHtml.length}`);

const nuxtScriptRegex = /<script>\s*window\.__NUXT__\s*=\s*([\s\S]*?)\s*;?\s*<\/script>/s;
const nuxtScriptMatch = listPageHtml.match(nuxtScriptRegex);

if (nuxtScriptMatch && nuxtScriptMatch[1]) {
    const iifeContent = nuxtScriptMatch[1].trim();
    console.log("\n--- Captured IIFE Content (from window.__NUXT__ assignment) ---");
    console.log("Full IIFE (first 1000 chars):", iifeContent.substring(0, 1000) + (iifeContent.length > 1000 ? "..." : ""));

    // Regex to extract: 1: params string, 2: return object string, 3: args string
    // Removed optional semicolon at the very end of the IIFE string pattern
    const iifeExtractRegex = /^\s*\(\s*function\s*\(([^)]*?)\)\s*\{[\s\S]*?return\s*(\{[\s\S]*?\})\s*;?\s*\}\s*\)\s*\(([\s\S]*?)\)\s*$/s;
    const extractedParts = iifeContent.match(iifeExtractRegex);

    if (extractedParts && extractedParts.length === 4) {
        const paramNamesStr = extractedParts[1];
        let returnObjectStr = extractedParts[2];
        const argValuesStr = extractedParts[3];

        console.log("\n--- IIFE Parts Extracted Successfully ---");
        console.log("Param Names String:", paramNamesStr);
        console.log("Return Object String (raw, first 500):", returnObjectStr.substring(0, 500) + "...");
        console.log("Argument Values String (raw, first 500):", argValuesStr.substring(0, 500) + "...");

        const paramNames = paramNamesStr.split(',').map(p => p.trim()).filter(p => p);
        const argValues = argValuesStr.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim());

        console.log("Parsed Param Names:", paramNames);
        console.log("Parsed Argument Values:", argValues);
        
        if (paramNames.length === argValues.length) {
            for (let i = 0; i < paramNames.length; i++) {
                const pName = paramNames[i];
                let pValue = argValues[i];
                if (pValue === 'void 0' || pValue === 'undefined') {
                    pValue = 'null';
                }
                returnObjectStr = returnObjectStr.replace(new RegExp(`(?<=[,:{\\[\\s])${pName}(?=[\\s,:}])`, 'g'), pValue);
            }

            returnObjectStr = returnObjectStr.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
            returnObjectStr = returnObjectStr.replace(/'([^']*)'/g, '"$1"');

            console.log("\n--- Return Object String After Replacements (first 1000 chars) ---");
            console.log(returnObjectStr.substring(0, 1000) + "...");

            try {
                const nuxtData = JSON.parse(returnObjectStr.replace(/\\u002F/g, '/'));
                if (nuxtData && nuxtData.data && nuxtData.data[0] && nuxtData.data[0].postList) {
                    console.log(`\n--- SUCCESS: Extracted ${nuxtData.data[0].postList.length} posts ---`);
                } else {
                    console.error("\n--- ERROR: postList not found in parsed nuxtData ---");
                    console.log("Parsed nuxtData.data[0]:", nuxtData && nuxtData.data && nuxtData.data[0]);
                }
            } catch (e) {
                console.error("\n--- ERROR: JSON.parse failed for the modified object string ---");
                console.error("Error message:", e.message);
                console.error("Problematic string (first 200 chars):", returnObjectStr.substring(0,200) + "...");
            }
        } else {
            console.error("\n--- ERROR: Mismatch between number of param names and argument values ---");
            console.log("Param names count:", paramNames.length, "Names:", paramNames);
            console.log("Argument values count:", argValues.length, "Values:", argValues);
        }
    } else {
        console.log("\n--- ERROR: Could not break down IIFE structure with iifeExtractRegex ---");
        console.log("Attempted to match on iifeContent (first 200 chars):", iifeContent.substring(0,200) + "...");
        console.log("Regex used:", iifeExtractRegex.toString());
        console.log("Match result:", extractedParts);
    }
} else {
    console.log("\n--- ERROR: nuxtScriptRegex did not match (Could not find window.__NUXT__ script block) ---");
}
