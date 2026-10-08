# Add “Append to Google Sheet” to your chatbot — Step by step

Follow these steps in order.

---

## Before you start (one time)

1. In **Integrations**, connect **Google Sheets** with your Google account and wait until it shows **connected**.
2. In Google Cloud (your admin may do this), turn **on** **Google Drive API** and **Google Sheets API** for your project.
3. Open your spreadsheet in Google. Put **column titles in row 1** (for example: `Name`, `Phone`, `Email`). Save the file.

---

## Fast path — One-click demo (optional)

If you already have **Google Sheets connected** and a **WhatsApp number connected**:

1. Open **Integrations → Google Sheets**, or open **Chatbots**.
2. Click **Try demo chatbot (Sheets)** / **Demo: Google Sheet** / **Create demo chatbot now**.
3. The system creates a **published** demo chatbot: **On Message** → **10 short questions** → **Append to Google Sheet**, using **your** Google connection and **your** WhatsApp session. You are taken to the builder to review.
4. In Google Sheets, **row 1** should include at least: `Phone`, `Name`, then `Reply 01` through `Reply 10` (or open the last step and click **Fetch fields** to align columns with your sheet).
5. Send WhatsApp messages and answer all 10 prompts; a new row should appear when you finish.

---

## Steps — Add the Google Sheet action

### Step 1 — Open the chatbot builder

1. Go to **Chatbots**.
2. Open the chatbot you want, or create a new one.

### Step 2 — Add the action block

1. In the **Actions** list, find **Append to Google Sheet**.
2. Drag it onto the canvas (or click to add it).
3. Connect it with an arrow from the step that should run **before** saving to the sheet (for example from **Ask Question**, or from **On Message**).

### Step 3 — Choose the Google file

1. Click the **Append to Google Sheet** block to open its settings.
2. Under **Google Sheets connection**, pick your saved connection.
3. Pick **Drive** (often “My Drive”).
4. Pick **Spreadsheet** (your file).
5. Pick **Worksheet** (the tab/sheet inside the file).

### Step 4 — Load columns from the sheet

1. Click **Fetch fields**.  
   This reads **row 1** of the worksheet and creates one field per column header.

### Step 5 — Fill each column

For each column shown:

1. Click in the box, **or** click the **database (Insert variable)** icon.
2. Use **Quick insert** buttons for common values (*Customer name*, *Customer phone*, *Latest answer*, etc.), **or** expand an earlier step and pick a field.
3. Repeat for every column you want filled.

You do **not** need to type codes yourself if you use Quick insert or Insert variable.

### Step 6 — Optional: Send a message after the sheet

1. Add **Send Text Message** (or another action) on the canvas.
2. Draw an arrow from **Append to Google Sheet** → **Send Text Message**.
3. Write your message in that block.

The sheet row is saved first; then your message is sent.

### Step 7 — Save and publish

1. Click **Save** on the chatbot.
2. Turn the chatbot **Published** if your panel uses draft/published.

### Step 8 — Test

1. Send a WhatsApp message that triggers this flow.
2. Open your Google Sheet and check that a **new row** appeared under row 1.

---

## If something fails

| Issue | Check |
|--------|--------|
| Cannot pick spreadsheets | Google **Drive API** enabled; wait a few minutes after enabling. |
| No new row | Connection still **connected**; correct spreadsheet and tab selected. |
| Empty column | Put **Ask Question** **before** the sheet step if you use “Latest answer”. |
| **Values in wrong columns** | Use **Fetch fields** so column names match row 1. Do **not** mix **Legacy A–E** with named headers — clear A–E unless you only use letter columns. Row order follows **your sheet’s row 1 left-to-right** (the product maps by header name). |
| CRM / Contacts columns | Add **Fetch Contact** before **Append to Google Sheet**. Then use **Quick insert**: Contact email / name / phone, or `{{contact.<your_column_id>}}` for custom columns (same ids as on the Contacts page). |


---

## Short checklist

- [ ] Integrations: Google Sheets **connected**
- [ ] Sheet: **Row 1** = headers  
- [ ] Chatbot: **Append to Google Sheet** connected in the right place  
- [ ] **Fetch fields** done, columns filled  
- [ ] **Saved** and **published**  
- [ ] **Tested** — new row in sheet  

---

For privacy: only map data you are allowed to store; the spreadsheet lives in **your** Google account.
