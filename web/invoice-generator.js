/**
 * Miami DJ Beat LLC - Professional Invoice Generator
 * Handles PDF creation with corporate branding, watermarks, and tabular layouts.
 */

window.generateInvoice = (leadData, items = [], depositAmount = 0, taxId = "N/A") => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Configuration
    const corporateColor = [26, 43, 86]; // Navy Blue
    const accentColor = [183, 148, 62]; // Gold

    // --- 1. WATERMARK (Fénix) ---
    // We'll use a large, light-gray text or a base64 image if possible.
    // Since we don't have the base64 of the logo here, we'll use a large, faint brand text for now.
    doc.setTextColor(240, 240, 240);
    doc.setFontSize(80);
    doc.setFont("Helvetica", "bold");
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.1 }));
    doc.text("MIAMI DJ BEAT", 105, 150, { align: 'center', angle: 45 });
    doc.restoreGraphicsState();

    // --- 2. HEADER BRANDING ---
    // Left: Logo placeholder / Brand name
    doc.setTextColor(corporateColor[0], corporateColor[1], corporateColor[2]);
    doc.setFontSize(22);
    doc.setFont("Helvetica", "bold");
    doc.text("MIAMI DJ BEAT LLC", 20, 25);
    doc.setFontSize(9);
    doc.text("ENTERTAINMENT & EVENTS CORPORATION", 20, 31);

    // Right: "INVOICE" Title
    doc.setFontSize(32);
    doc.setTextColor(0);
    doc.text("INVOICE", 190, 25, { align: 'right' });

    // Center/Right: Corporate Info
    doc.setFontSize(9);
    doc.setFont("Helvetica", "bold");
    doc.text("MIAMI DJ BEAT LLC", 190, 40, { align: 'right' });
    doc.setFont("Helvetica", "normal");
    doc.text("1005 W 77 St Apt 105", 190, 45, { align: 'right' });
    doc.text("Hialeah FL 33014", 190, 50, { align: 'right' });
    doc.text("Phone: (305)-543-4814", 190, 55, { align: 'right' });
    doc.text("Mail: miamidjbeat@soporte.com", 190, 60, { align: 'right' });
    doc.text("Web: Miamidjbeat.com", 190, 65, { align: 'right' });

    // --- 3. CUSTOMER INFO ---
    doc.setFontSize(10);
    doc.setFont("Helvetica", "bold");
    doc.text("Invoice No.", 20, 80);
    doc.text("Customer:", 20, 87);
    doc.text("ID:", 20, 94);

    doc.setFont("Helvetica", "normal");
    doc.text("INV-" + Date.now().toString().slice(-6), 50, 80);
    doc.text(leadData.email || "Gerardo A Valle", 50, 87); // Pre-fill with lead email or placeholder
    doc.text(leadData.id || "N/A", 50, 94);

    doc.setFont("Helvetica", "bold");
    doc.text("Bill To:", 105, 80);
    doc.text("Ship To:", 155, 80);
    doc.setFont("Helvetica", "normal");
    doc.text(leadData.location || "Miami, FL", 105, 87, { maxWidth: 45 });

    // --- 4. TOP TABLE (Meta Data) ---
    doc.setFillColor(245, 245, 245);
    doc.rect(20, 110, 170, 8, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 110, 190, 110);
    doc.line(20, 118, 190, 118);

    doc.setFontSize(9);
    doc.setFont("Helvetica", "bold");
    const headers = ["Date", "Order No.", "Sales Rep.", "FOB", "Ship Via", "Terms", "Tax ID"];
    let hX = 22;
    headers.forEach(h => {
        doc.text(h, hX, 115);
        hX += 24.3;
    });

    // Dummy values for meta table
    doc.setFont("Helvetica", "normal");
    doc.text(new Date().toLocaleDateString(), 22, 125);
    doc.text(leadData.id ? leadData.id.toString().slice(0, 8) : "N/A", 46.3, 125);
    doc.text("MDJPRO-AUTO", 70.6, 125);
    doc.text(taxId, 167.8, 125); // Populate Tax ID column

    // --- 5. MAIN EQUIPMENT TABLE ---
    const startY = 140;
    doc.setFillColor(235, 235, 235);
    doc.rect(20, startY, 170, 10, 'F');
    doc.line(20, startY, 190, startY);
    doc.line(20, startY + 10, 190, startY + 10);

    doc.setFont("Helvetica", "bold");
    const mainHeaders = ["Equip", "Model", "Date", "Tracking Number", "Tax", "Unit", "Total"];
    let mX = 22;
    const colWidths = [35, 30, 20, 35, 15, 15, 20];
    mainHeaders.forEach((h, i) => {
        doc.text(h, mX, startY + 6.5);
        mX += colWidths[i];
    });

    // Items
    let currentY = startY + 10;
    let subtotal = 0;

    // Default items if none provided (from lead/common FX)
    const displayItems = items.length > 0 ? items : [
        { equip: "Audio System", model: "RCF 712 x2", date: leadData.event_date || "TBD", tracking: "MDJ-RENTAL-01", tax: "7%", unit: 120, total: 120 },
        { equip: "Cold Sparks", model: "Sparkular PRO x2", date: leadData.event_date || "TBD", tracking: "FX-SPARK-44", tax: "7%", unit: 250, total: 250 }
    ];

    doc.setFont("Helvetica", "normal");
    displayItems.forEach(item => {
        let iX = 22;
        doc.line(20, currentY, 20, currentY + 8); // Side borders for visual structure
        doc.line(190, currentY, 190, currentY + 8);

        doc.text(item.equip.toString(), iX, currentY + 5.5); iX += colWidths[0];
        doc.text(item.model.toString(), iX, currentY + 5.5); iX += colWidths[1];
        doc.text(item.date.toString(), iX, currentY + 5.5); iX += colWidths[2];
        doc.text(item.tracking.toString(), iX, currentY + 5.5); iX += colWidths[3];
        doc.text(item.tax.toString(), iX, currentY + 5.5); iX += colWidths[4];
        doc.text("$" + item.unit.toFixed(2), iX, currentY + 5.5); iX += colWidths[5];
        doc.text("$" + item.total.toFixed(2), iX, currentY + 5.5);

        subtotal += item.total;
        currentY += 8;
        doc.line(20, currentY, 190, currentY); // Bottom line of row
    });

    // Fill remaining table lines for aesthetics
    for (let i = 0; i < 8; i++) {
        doc.line(20, currentY, 20, currentY + 8);
        doc.line(190, currentY, 190, currentY + 8);
        currentY += 8;
        doc.line(20, currentY, 190, currentY);
    }

    // --- 6. TOTALS BLOCK ---
    const totalY = currentY + 10;
    const rightAlignX = 190;
    const labelX = 145;

    const tax = subtotal * 0.07;
    const grandTotal = subtotal + tax;

    const SummaryItems = [
        { label: "Subtotal:", val: subtotal },
        { label: "Tax (7%):", val: tax },
        { label: "Shipping:", val: 0 },
        { label: "Total Revenue:", val: grandTotal },
        { label: "Reservation Deposit Paid:", val: -depositAmount, bold: true, color: [200, 0, 0] },
        { label: "Balance Due:", val: grandTotal - depositAmount, bold: true, color: corporateColor }
    ];

    SummaryItems.forEach((s, i) => {
        doc.setDrawColor(200, 200, 200);
        doc.rect(labelX, totalY + (i * 8), 45, 8);
        doc.setFont("Helvetica", s.bold ? "bold" : "normal");
        if (s.color) doc.setTextColor(s.color[0], s.color[1], s.color[2]);
        else doc.setTextColor(0);

        doc.text(s.label, labelX + 2, totalY + (i * 8) + 5.5);
        doc.text("$" + s.val.toFixed(2), rightAlignX - 2, totalY + (i * 8) + 5.5, { align: 'right' });
    });
    doc.setTextColor(0); // Reset

    // --- 7. FOOTER ---
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.setFont("Helvetica", "italic");
    doc.text("Thank You For Business It's a Pleasure to work with you on your project.", 20, totalY + 10);

    doc.setFont("Helvetica", "normal");
    doc.text("Sincerely,", 20, totalY + 25);
    doc.text("Gerardo A Valle", 20, totalY + 32);

    doc.save(`Invoice_${leadData.id || "MDJ"}_${Date.now()}.pdf`);
};
