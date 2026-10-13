import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'(<div className="top-bar">.*?\n          </div>\n          </div>)', r'{siteData.section_visibility?.top_bar !== false && (\n          \1\n          )}', content, flags=re.DOTALL)
content = re.sub(r'(<header className="site-header">.*?\n          </header>)', r'{siteData.section_visibility?.header !== false && (\n          \1\n          )}', content, flags=re.DOTALL)
content = re.sub(r'(<section className="product-section".*?\n          </section>)', r'{siteData.section_visibility?.product !== false && (\n          \1\n          )}', content, flags=re.DOTALL)
content = re.sub(r'(<section className="features-row-sec".*?\n          </section>)', r'{siteData.section_visibility?.features !== false && (\n          \1\n          )}', content, flags=re.DOTALL)
content = re.sub(r'(<section className="benefits-sec".*?\n          </section>)', r'{siteData.section_visibility?.benefits_section !== false && (\n          \1\n          )}', content, flags=re.DOTALL)
content = re.sub(r'(<section className="hotspots-sec".*?\n          </section>)', r'{siteData.section_visibility?.hotspots_section !== false && (\n          \1\n          )}', content, flags=re.DOTALL)
content = re.sub(r'(<section className="comparison-sec".*?\n          </section>)', r'{siteData.section_visibility?.comparison_section !== false && (\n          \1\n          )}', content, flags=re.DOTALL)
content = re.sub(r'(<section className="reviews-sec".*?\n          </section>)', r'{siteData.section_visibility?.reviews_section !== false && (\n          \1\n          )}', content, flags=re.DOTALL)
content = re.sub(r'(<section className="faq-sec".*?\n          </section>)', r'{siteData.section_visibility?.faq_section !== false && (\n          \1\n          )}', content, flags=re.DOTALL)
content = re.sub(r'(<footer className="site-footer".*?\n          </footer>)', r'{siteData.section_visibility?.footer !== false && (\n          \1\n          )}', content, flags=re.DOTALL)

# Add visibility for nav links too
content = re.sub(r'\{(siteData\.header\?\.nav_links \|\| \[\])\.map\(\(nav, idx\) => \(', r'{\1.filter(nav => {\n                    const sectionId = nav.href.replace("#", "");\n                    if (sectionId === "product") return siteData.section_visibility?.product !== false;\n                    if (sectionId === "benefits") return siteData.section_visibility?.benefits_section !== false;\n                    if (sectionId === "hotspots") return siteData.section_visibility?.hotspots_section !== false;\n                    if (sectionId === "comparison") return siteData.section_visibility?.comparison_section !== false;\n                    if (sectionId === "reviews") return siteData.section_visibility?.reviews_section !== false;\n                    if (sectionId === "faq") return siteData.section_visibility?.faq_section !== false;\n                    return true;\n                  }).map((nav, idx) => (', content)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
