# 🚀 Fast Indexing Setup Guide

This guide will help you get your 21 non-indexed pages crawled by Google as quickly as possible.

## Immediate Actions (Do These Now!)

### 1. Fix robots.txt (5 minutes)

Your current robots.txt is blocking pages. Replace it with the optimized version:

```bash
# Copy the new robots.txt to your website root
cp public/robots.txt /path/to/your/website/
```

Or manually upload `public/robots.txt` to your web server.

**Key changes:**
- Removed accidental blocks
- Added explicit `Allow: /` for Googlebot
- Added sitemap reference
- Set `Crawl-delay: 0` for fastest crawling

### 2. Submit Sitemap (2 minutes)

1. Upload `public/sitemap.xml` to your website root
2. Go to [Google Search Console](https://search.google.com/search-console)
3. Select `stiltnerlandscapes.com`
4. Navigate to **Sitemaps** in the left sidebar
5. Enter `sitemap.xml` and click **Submit**

### 3. Request Indexing Manually (15 minutes)

For each important page:

1. Go to Search Console
2. Use the **URL Inspection** tool (magnifying glass at top)
3. Enter each URL
4. Click **Request Indexing**

**Priority order:**
1. `https://stiltnerlandscapes.com/` (homepage)
2. `https://stiltnerlandscapes.com/contact`
3. `https://stiltnerlandscapes.com/services`
4. `https://stiltnerlandscapes.com/free-quote`
5. Service pages (landscape-design, hardscaping, etc.)

### 4. Add SEO Meta Tags (30 minutes)

Copy the contents of `public/seo-head-template.html` into your website's `<head>` section.

**Replace these placeholders:**
- `[City, State]` → Your actual location
- `XX.XXXXX` → Your GPS coordinates
- `+1-XXX-XXX-XXXX` → Your phone number
- `GTM-XXXXXXX` → Your GTM container ID
- `YOUR_VERIFICATION_CODE` → From Search Console

### 5. Add Structured Data (10 minutes)

The `public/schema.json` file contains LocalBusiness schema. Either:

A) **Inline it** in your HTML `<head>` as a `<script type="application/ld+json">` tag, OR

B) **Reference it** if your framework supports external JSON-LD

---

## Automated Indexing (Optional but Powerful)

### Set Up Google Indexing API

This allows programmatic URL submission for near-instant indexing.

#### Step 1: Create Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable the **Indexing API**:
   - Go to APIs & Services > Library
   - Search for "Indexing API"
   - Click Enable

4. Create Service Account:
   - Go to APIs & Services > Credentials
   - Click "Create Credentials" > "Service Account"
   - Name it `indexing-bot`
   - Grant role: None needed
   - Click Done

5. Create Key:
   - Click on the service account
   - Go to Keys tab
   - Add Key > Create new key > JSON
   - Save the downloaded file

#### Step 2: Add to Search Console

1. Copy the service account email (looks like `indexing-bot@project.iam.gserviceaccount.com`)
2. Go to Search Console > Settings > Users and permissions
3. Add user with the service account email
4. Set permission to **Owner**

#### Step 3: Configure Environment

```bash
# In your .env file, add the entire JSON key (single line)
GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
```

#### Step 4: Run Batch Submission

```bash
cd backend
npx tsx scripts/submit-for-indexing.ts
```

This will submit all 20+ URLs to Google's Indexing API, typically resulting in indexing within hours!

---

## API Endpoints

Once configured, you can also use these API endpoints:

### Submit Single URL
```bash
curl -X POST http://localhost:3001/api/v1/indexing/submit \
  -H "Content-Type: application/json" \
  -d '{"url": "https://stiltnerlandscapes.com/services/hardscaping"}'
```

### Submit Multiple URLs
```bash
curl -X POST http://localhost:3001/api/v1/indexing/batch \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://stiltnerlandscapes.com/services/landscape-design",
      "https://stiltnerlandscapes.com/services/hardscaping",
      "https://stiltnerlandscapes.com/services/lawn-care"
    ]
  }'
```

### Check URL Status
```bash
curl "http://localhost:3001/api/v1/indexing/status?url=https://stiltnerlandscapes.com/"
```

---

## Monitoring Progress

### Check Indexing Status

1. Go to Search Console
2. Navigate to **Pages** under Indexing
3. Look for reduction in "Not indexed" count
4. Check "Why pages aren't indexed" section

### Expected Timeline

| Method | Time to Index |
|--------|---------------|
| Indexing API | 1-24 hours |
| URL Inspection + Request | 1-7 days |
| Sitemap submission only | 1-2 weeks |
| Natural crawl (no action) | 2-4 weeks |

---

## Troubleshooting

### "Blocked by robots.txt" still showing

- Ensure you uploaded the new `robots.txt`
- Clear CDN cache if using one
- Verify at: `https://stiltnerlandscapes.com/robots.txt`

### "Discovered - currently not indexed"

This means Google found the URLs but hasn't prioritized them. Solutions:

1. Use the Indexing API (fastest)
2. Request indexing via URL Inspection
3. Add more internal links to these pages
4. Get external backlinks

### Indexing API quota exceeded

Google allows 200 requests/day per property. If you hit this:

1. Wait 24 hours
2. Prioritize most important pages first
3. Use URL Inspection for remaining pages

---

## Additional SEO Wins

### 1. Core Web Vitals
Ensure your pages pass Core Web Vitals:
- LCP < 2.5s
- FID < 100ms
- CLS < 0.1

### 2. Mobile-First
Google indexes mobile version first. Test at:
https://search.google.com/test/mobile-friendly

### 3. Page Speed
Test and optimize at:
https://pagespeed.web.dev/

### 4. Internal Linking
Add links between your pages:
- Homepage → All service pages
- Service pages → Contact/Quote page
- Blog posts → Relevant service pages

---

## Questions?

If indexing issues persist after 7 days:
1. Check for manual actions in Search Console
2. Verify there are no crawl errors
3. Ensure pages return 200 status codes
4. Check that pages have unique, quality content

