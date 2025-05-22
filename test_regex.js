const fs = require('fs');
const path = require('path');

// 读取HTML文件内容 (请确保 test_page.html 与此脚本在同一目录，或修改路径)
const htmlFilePath = path.join(__dirname, 'test_page.html');
let listPageHtml = '';
try {
    listPageHtml = fs.readFileSync(htmlFilePath, 'utf8');
} catch (err) {
    console.error('Error reading test_page.html:', err.message);
    process.exit(1);
}

console.log(`Read ${htmlFilePath}, length: ${listPageHtml.length}`);

// 在这里定义和测试你的正则表达式
// 正则1: 尝试捕获 IIFE 返回的对象字符串
const regex1 = /window\.__NUXT__\s*=\s*\(function\s*\(.*?\)\s*\{[\s\S]*?return\s*(\{[\s\S]*?\})\s*\}\)\s*\(.*?\)\s*;/s;
const match1 = listPageHtml.match(regex1);

if (match1 && match1[1]) {
    console.log("\n--- Regex 1: Matched IIFE return object ---");
    console.log("Captured group 1 (object string, first 1000 chars):");
    console.log(match1[1].substring(0, 1000) + (match1[1].length > 1000 ? "..." : ""));
    // 在这里可以尝试进一步处理 match1[1]，例如参数替换和 JSON.parse
} else {
    console.log("\n--- Regex 1: Did NOT match IIFE return object ---");
}

// 正则2: 尝试捕获整个 window.__NUXT__ 赋值的脚本内容 (IIFE本身)
const regex2 = /<script>\s*window\.__NUXT__\s*=\s*([\s\S]*?)\s*;?\s*<\/script>/s;
const match2 = listPageHtml.match(regex2);

if (match2 && match2[1]) {
    console.log("\n--- Regex 2: Matched full window.__NUXT__ assignment ---");
    console.log("Captured group 1 (full assignment, first 1000 chars):");
    console.log(match2[1].substring(0, 1000) + (match2[1].length > 1000 ? "..." : ""));
    
    // 从这里可以尝试提取参数和函数体
    const iifeContent = match2[1];
    const iifeStructureMatch = iifeContent.match(/^\s*\((function\s*\(([^)]*?)\)\s*\{[\s\S]*?return\s*(\{[\s\S]*?\})\s*\}\s*)\)\s*\(([^;]*?)\)\s*$/s);
    if (iifeStructureMatch) {
        console.log("\n--- Regex 2.1: IIFE Structure Breakdown ---");
        const funcParams = iifeStructureMatch[2];
        const returnObjectStr = iifeStructureMatch[3];
        const funcArgs = iifeStructureMatch[4];
        console.log("Function Params:", funcParams);
        console.log("Return Object String (first 500):", returnObjectStr.substring(0,500) + "...");
        console.log("Function Arguments (first 500):", funcArgs.substring(0,500) + "...");
        // 这里可以进一步尝试解析和替换参数
    } else {
        console.log("\n--- Regex 2.1: Could not break down IIFE structure from Regex 2 match ---");
    }

} else {
    console.log("\n--- Regex 2: Did NOT match full window.__NUXT__ assignment ---");
}

// 正则3: 之前尝试直接匹配 data 数组的正则 (可能因上下文不足而失败)
const regex3 = /data:\s*(\[[\s\S]*?\])\s*,\s*fetch:/s;
const match3 = listPageHtml.match(regex3);
if (match3 && match3[1]) {
    console.log("\n--- Regex 3: Matched data array directly ---");
    console.log("Captured group 1 (data array string, first 500 chars):");
    console.log(match3[1].substring(0, 500) + (match3[1].length > 500 ? "..." : ""));
} else {
    console.log("\n--- Regex 3: Did NOT match data array directly ---");
}

// 您可以在这里添加更多正则表达式进行测试
