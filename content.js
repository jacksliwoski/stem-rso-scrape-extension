(async function() {
  // 1) Wait function
  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 2) Continuously click “Load More” until it disappears
  async function expandAllResults() {
    while (true) {
      // look for a button whose text is exactly “Load More” (case‐insensitive)
      const btn = Array.from(document.querySelectorAll("button")).find(b =>
        b.innerText.trim().toLowerCase() === "load more"
      );
      if (!btn) break;            // no load‐more button left → stop
      btn.click();                // simulate a click
      await wait(1500);           // give it 1.5s to fetch & append new results
    }
  }

  // 3) Helper to fetch a detail page and grab the first “@uw.edu”
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

  // 4) Expand everything on the listing page first
  console.log("[RSO Scraper] Expanding all pages…");
  await expandAllResults();
  console.log("[RSO Scraper] All results loaded.");

  // 5) Now gather every <a href="/organization/..."> card
  const orgAnchors = Array.from(
    document.querySelectorAll("#org-search-results a[href^='/organization/']")
  );
  if (orgAnchors.length === 0) {
    console.error("[RSO Scraper] No organization links found. Has the DOM changed?");
    return;
  }

  // 6) For each anchor, grab the name and then fetch its detail page
  const rows = [];
  for (let anchor of orgAnchors) {
    const text = anchor.innerText.trim();
    const orgName = text.split("\n")[0];         // first line is the name
    const relHref = anchor.getAttribute("href"); // e.g. "/organization/thinkcyber"
    console.log(`[RSO Scraper] Fetching email for ${orgName} → ${relHref}`);
    const email = await fetchEmailFromOrgDetail(relHref);
    console.log(`  → ${orgName}: ${email || "<no email found>"}`);
    rows.push([orgName, email]);
  }

  // 7) Build CSV text
  let csv = "Organization Name,Email Address\n";
  for (let [name, address] of rows) {
    const safeName = `"${name.replace(/"/g, '""')}"`;
    const safeAddr = `"${(address || "").replace(/"/g, '""')}"`;
    csv += `${safeName},${safeAddr}\n`;
  }

  // 8) Trigger download
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "rso_emails.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log(`[RSO Scraper] Done. CSV with ${rows.length} rows downloaded.`);
})();
