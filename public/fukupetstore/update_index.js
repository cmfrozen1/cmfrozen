const fs = require('fs');

let content = fs.readFileSync('index.html', 'utf-8');

content = content.replace(/(<div className="top-bar">[\s\S]*?\n          <\/div>\n          <\/div>)/, '{siteData.section_visibility?.top_bar !== false && (\n          $1\n          )}');
content = content.replace(/(<header className="site-header">[\s\S]*?\n          <\/header>)/, '{siteData.section_visibility?.header !== false && (\n          $1\n          )}');
content = content.replace(/(<section className="product-section"[\s\S]*?\n          <\/section>)/, '{siteData.section_visibility?.product !== false && (\n          $1\n          )}');
content = content.replace(/(<section className="features-row-sec"[\s\S]*?\n          <\/section>)/, '{siteData.section_visibility?.features !== false && (\n          $1\n          )}');
content = content.replace(/(<section className="benefits-sec"[\s\S]*?\n          <\/section>)/, '{siteData.section_visibility?.benefits_section !== false && (\n          $1\n          )}');
content = content.replace(/(<section className="hotspots-sec"[\s\S]*?\n          <\/section>)/, '{siteData.section_visibility?.hotspots_section !== false && (\n          $1\n          )}');
content = content.replace(/(<section className="comparison-sec"[\s\S]*?\n          <\/section>)/, '{siteData.section_visibility?.comparison_section !== false && (\n          $1\n          )}');
content = content.replace(/(<section className="reviews-sec"[\s\S]*?\n          <\/section>)/, '{siteData.section_visibility?.reviews_section !== false && (\n          $1\n          )}');
content = content.replace(/(<section className="faq-sec"[\s\S]*?\n          <\/section>)/, '{siteData.section_visibility?.faq_section !== false && (\n          $1\n          )}');
content = content.replace(/(<footer className="site-footer"[\s\S]*?\n          <\/footer>)/, '{siteData.section_visibility?.footer !== false && (\n          $1\n          )}');

content = content.replace(/\{\(siteData\.header\?\.nav_links \|\| \[\]\)\.map\(\(nav, idx\) => \(/, 
`{(siteData.header?.nav_links || []).filter(nav => {
                    const sectionId = nav.href.replace("#", "");
                    if (sectionId === "product") return siteData.section_visibility?.product !== false;
                    if (sectionId === "benefits") return siteData.section_visibility?.benefits_section !== false;
                    if (sectionId === "hotspots") return siteData.section_visibility?.hotspots_section !== false;
                    if (sectionId === "comparison") return siteData.section_visibility?.comparison_section !== false;
                    if (sectionId === "reviews") return siteData.section_visibility?.reviews_section !== false;
                    if (sectionId === "faq") return siteData.section_visibility?.faq_section !== false;
                    return true;
                  }).map((nav, idx) => (`);

fs.writeFileSync('index.html', content, 'utf-8');
console.log("Done");
