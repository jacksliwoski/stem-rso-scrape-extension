(async function() {
  // 1) Utility to pause
  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 2) Click “Load More” until it disappears
  async function expandAllResults() {
    while (true) {
      const btn = Array.from(document.querySelectorAll("button")).find(b =>
        b.innerText.trim().toLowerCase() === "load more"
      );
      if (!btn) break;
      btn.click();
      await wait(1500);
    }
  }

  // 3) Fetch detail page and extract first “@uw.edu”
  async function fetchEmailFromOrgDetail(relativePath) {
    const detailUrl = window.location.origin + relativePath;
    try {
      const resp = await fetch(detailUrl);
      if (!resp.ok) {
        console.warn(`[RSO Scraper] Failed to fetch ${detailUrl}: ${resp.status}`);
        return "";
      }
      const html = await resp.text();
      const emailMatch = html.match(/\b[A-Za-z0-9._%+-]+@uw\.edu\b/);
      return emailMatch ? emailMatch[0] : "";
    } catch (err) {
      console.error(`[RSO Scraper] Error fetching/parsing ${detailUrl}:`, err);
      return "";
    }
  }

  // 4) Expand all “Load More” batches
  console.log("[RSO Scraper] Expanding all results…");
  await expandAllResults();
  console.log("[RSO Scraper] All results loaded.");

  // 5) Collect every organization link
  const orgAnchors = Array.from(
    document.querySelectorAll("#org-search-results a[href^='/organization/']")
  );
  if (orgAnchors.length === 0) {
    console.error("[RSO Scraper] No organization links found. Has the DOM changed?");
    return;
  }

  // 6) For each anchor: grab name, description excerpt, then fetch its email
  const rows = [];
  for (let anchor of orgAnchors) {
    // a) Name is the first line of visible text
    const fullText = anchor.innerText.trim();
    const orgName = fullText.split("\n")[0];

    // b) Description excerpt is in the <p class="DescriptionExcerpt">
    let descNode = anchor.querySelector(".DescriptionExcerpt");
    const orgDesc = descNode ? descNode.innerText.trim() : "";

    // c) Fetch email from detail page
    const relHref = anchor.getAttribute("href"); // e.g. "/organization/thinkcyber"
    console.log(`[RSO Scraper] Fetching email for ${orgName} → ${relHref}`);
    const email = await fetchEmailFromOrgDetail(relHref);
    console.log(`  → ${orgName}: ${email || "<no email found>"}`);

    rows.push([orgName, email, orgDesc]);
  }

  // 7) Build CSV text with three columns
  let csv = "Organization Name,Email Address,Description\n";
  for (let [name, address, desc] of rows) {
    const safeName = `"${name.replace(/"/g, '""')}"`;
    const safeAddr = `"${(address || "").replace(/"/g, '""')}"`;
    const safeDesc = `"${desc.replace(/"/g, '""')}"`;
    csv += `${safeName},${safeAddr},${safeDesc}\n`;
  }

  // 8) Trigger CSV download
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "rso_emails_and_descriptions.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log(`[RSO Scraper] Done. CSV with ${rows.length} rows downloaded.`);
})();
