// apps/api/src/routes/abr.ts
import { Router } from "express";

const router = Router();

router.get("/abn/:abn", async (req, res) => {
  try {
    const abn = String(req.params.abn || "").replace(/\D/g, "");
    if (!/^\d{11}$/.test(abn)) {
      return res.status(400).json({ ok: false, message: "ABN must be 11 digits" });
    }

    const guid = process.env.ABR_GUID;
    if (!guid) {
      return res.status(500).json({ ok: false, message: "ABR GUID not configured" });
    }

    const url = new URL("https://abr.business.gov.au/json/AbnDetails.aspx");
    url.searchParams.set("abn", abn);
    url.searchParams.set("guid", guid);

    const resp = await fetch(url.toString(), {
      // ABR supports JSON and JSONP; omit callback to get JSON
      headers: { Accept: "application/json" },
    });
    const text = await resp.text();
    if (!resp.ok) {
      return res.status(resp.status).json({ ok: false, message: text || "ABR request failed" });
    }

    // Handle the case the service returns JSONP despite Accept header
    const jsonText = text.trim().match(/^\w+\((.*)\);?$/)?.[1] ?? text;
    let data: any;
    try {
      data = JSON.parse(jsonText);
    } catch (e) {
      return res.status(502).json({ ok: false, message: "Invalid ABR response" });
    }

    // Normalise to a simple shape we can use on the client
    const entityName =
      data?.EntityName ||
      data?.MainName?.OrganisationName ||
      data?.MainName?.NonIndividualName ||
      data?.MainName ||
      null;

    const businessNames: string[] = [];
    if (Array.isArray(data?.BusinessName)) {
      for (const n of data.BusinessName) {
        if (typeof n === "string") businessNames.push(n);
        else if (n && typeof n === "object") {
          if (n.OrganisationName) businessNames.push(n.OrganisationName);
          else if (n.Name) businessNames.push(n.Name);
        }
      }
    } else if (data?.MainTradingName) {
      if (typeof data.MainTradingName === "string") businessNames.push(data.MainTradingName);
      else if (data.MainTradingName?.OrganisationName) businessNames.push(data.MainTradingName.OrganisationName);
    }

    return res.json({ ok: true, raw: data, entityName, businessNames });
  } catch (e: any) {
    console.error("[abr] lookup error:", e);
    return res.status(500).json({ ok: false, message: "ABR lookup failed" });
  }
});

export default router;

