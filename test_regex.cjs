const fs = require('fs');
const path = require('path');
const vm = require('vm'); 

const htmlFilePath = path.join(__dirname, 'test_page.html');
let listPageHtml = '';
try {
    listPageHtml = fs.readFileSync(htmlFilePath, 'utf8');
} catch (err) {
    console.error('Error reading test_page.html:', err.message);
    process.exit(1);
}

console.log(`Read ${htmlFilePath}, length: ${listPageHtml.length}`);

const nuxtScriptRegex = /<script>\s*window\.__NUXT__\s*=\s*([\s\S]+?)\s*;?\s*<\/script>/s;
const nuxtScriptMatch = listPageHtml.match(nuxtScriptRegex);

if (nuxtScriptMatch && nuxtScriptMatch[1]) {
    const iifeString = nuxtScriptMatch[1].trim();
    console.log("\n--- Captured IIFE String ---");

    try {
        const nuxtData = vm.runInNewContext(iifeString);

        if (nuxtData && nuxtData.data && Array.isArray(nuxtData.data) && nuxtData.data[0] && nuxtData.data[0].postList) {
            const posts = nuxtData.data[0].postList;
            console.log(`\n--- SUCCESS: Extracted ${posts.length} posts using vm module ---`);

            if (posts.length > 0) {
                // Find a non-VIP post to test, or test the first one and note if it's VIP
                let postToTest = null;
                for (const p of posts) {
                    if (p.title && !p.title.includes('[VIP]')) {
                        postToTest = p;
                        break;
                    }
                }
                if (!postToTest && posts.length > 0) {
                    console.log("\n--- WARNING: No non-VIP posts found to test, using the first post (might be VIP) ---");
                    postToTest = posts[0];
                }


                if (postToTest) {
                    console.log("\n--- Processing a post for itemDescription test ---");
                    const post = postToTest;
                    const title = post.title;
                    
                    if (title && title.includes('[VIP]')) {
                        console.log(`Skipping VIP item for detailed description generation in test: ${title}`);
                    } else {
                        let itemDescription = `<p>${title}</p>`;
                        const thumbnailUrl = post.img;
                        let baseImageUrl = '';

                        console.log(`Post Title: ${title}`);
                        console.log(`Thumbnail URL: ${thumbnailUrl}`);

                        if (thumbnailUrl) {
                            itemDescription += `<img src="${thumbnailUrl}" alt="${title} (Thumbnail)"><br>`;
                            if (thumbnailUrl.includes('thumbnail.jpg') || thumbnailUrl.includes('snapshot_')) {
                                baseImageUrl = thumbnailUrl.substring(0, thumbnailUrl.lastIndexOf('/') + 1);
                            } else {
                                baseImageUrl = thumbnailUrl.substring(0, thumbnailUrl.lastIndexOf('/') + 1);
                                console.warn(`WARN: Thumbnail URL "${thumbnailUrl}" does not match expected patterns for deriving base image path. Image sequence might be incomplete.`);
                            }
                        }
                        console.log(`Derived baseImageUrl: "${baseImageUrl}"`);

                        // Corrected regex for imageCount: matches "XXP" at the end of the string or followed by non-digits
                        const countMatch = title.match(/(\d+)P(?:[^0-9]|$)/i);
                        let imageCount = 0;
                        if (countMatch && countMatch[1]) {
                            imageCount = parseInt(countMatch[1], 10);
                        }
                        console.log(`Detected imageCount: ${imageCount}`);

                        if (baseImageUrl && imageCount > 0) {
                            console.log(`Entering image sequence loop for ${imageCount} images.`);
                            for (let k = 1; k <= imageCount; k++) {
                                const imageName = k + '.jpg';
                                if (baseImageUrl + imageName !== thumbnailUrl) {
                                    itemDescription += `<img src="${baseImageUrl}${imageName}" alt="${title} - Image ${k}"><br>`;
                                } else {
                                    console.log(`Skipping image ${imageName} as it's same as thumbnail.`);
                                }
                            }
                        } else {
                            console.log(`Skipping image sequence loop. baseImageUrl: "${baseImageUrl}", imageCount: ${imageCount}`);
                        }
                        console.log("\n--- Generated itemDescription: ---");
                        console.log(itemDescription);
                    }
                } else {
                    console.log("\n--- No posts available to test itemDescription generation ---");
                }
            }

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
