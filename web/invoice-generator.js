/**
 * Miami DJ Beat LLC — Invoice PDF (jsPDF)
 * Layout aligned with web/assets/invoice_template.jpg — Bill To / Ship To, classic tables, FL tax.
 */

const MDJ_INVOICE_TAX_RATE = 0.07;

const MDJ_INVOICE_COMPANY = {
    legalName: 'Miami DJ Beat LLC',
    tagline: 'ENTERTAINMENT & EVENTS CORPORATION',
    addressLine1: '1005 W 77 St Apt 105',
    addressLine2: 'Hialeah, FL 33014',
    phone: '(305) 607-1780',
    email: 'miamidjbeat@gmail.com',
    web: 'www.miamidjbeat.com',
    einDefault: ''
};

const MDJ_INVOICE_LOGO_URL = './Branding%20Invoice.png';

function mdjFetchInvoiceLogoDataUrl() {
    var cache = (window.mdjInvoiceLogoByUrl = window.mdjInvoiceLogoByUrl || {});
    if (cache[MDJ_INVOICE_LOGO_URL]) return Promise.resolve(cache[MDJ_INVOICE_LOGO_URL]);
    return fetch(MDJ_INVOICE_LOGO_URL, { cache: 'force-cache' })
        .then(function (r) {
            if (!r.ok) throw new Error('logo fetch');
            return r.blob();
        })
        .then(function (blob) {
            return new Promise(function (resolve, reject) {
                var fr = new FileReader();
                fr.onload = function () {
                    cache[MDJ_INVOICE_LOGO_URL] = fr.result;
                    resolve(fr.result);
                };
                fr.onerror = reject;
                fr.readAsDataURL(blob);
            });
        });
}

function mdjResolveSellerEin(L) {
    var raw = (
        (L && L.seller_ein) ||
        (L && L.mdj_ein) ||
        (L && L.company_ein) ||
        (typeof window !== 'undefined' && window.MDJ_INVOICE_SELLER_EIN) ||
        MDJ_INVOICE_COMPANY.einDefault ||
        ''
    )
        .toString()
        .trim();
    return raw;
}

function mdjInvoiceTaxColPercent(leadData) {
    var r =
        leadData && typeof leadData.tax_rate === 'number' && !isNaN(leadData.tax_rate)
            ? leadData.tax_rate
            : MDJ_INVOICE_TAX_RATE;
    if (r < 0 || r > 0.5) r = MDJ_INVOICE_TAX_RATE;
    return (Math.round(r * 1000) / 10) + '%';
}

function mdjNormalizeInvoiceItems(items, leadData) {
    if (!Array.isArray(items) || items.length === 0) return [];
    const ed = (leadData && leadData.event_date) || 'TBD';
    const taxCol = mdjInvoiceTaxColPercent(leadData);
    return items
        .map(function (it) {
            if (!it || typeof it !== 'object') return null;
            if (it.description != null && (it.price != null || it.total != null)) {
                const p = parseFloat(it.price != null ? it.price : it.total);
                const num = isNaN(p) ? 0 : p;
                return {
                    equip: String(it.description),
                    model: it.model != null ? String(it.model) : '—',
                    date: it.date != null ? String(it.date) : ed,
                    tracking: it.tracking != null ? String(it.tracking) : '—',
                    tax: taxCol,
                    unit: num,
                    total: num
                };
            }
            if (it.equip != null) {
                const t = parseFloat(it.total != null ? it.total : it.unit);
                const tot = isNaN(t) ? 0 : t;
                return {
                    equip: String(it.equip),
                    model: it.model != null ? String(it.model) : '—',
                    date: it.date != null ? String(it.date) : ed,
                    tracking: it.tracking != null ? String(it.tracking) : '—',
                    tax: it.tax != null ? String(it.tax) : taxCol,
                    unit: parseFloat(it.unit) >= 0 && !isNaN(parseFloat(it.unit)) ? parseFloat(it.unit) : tot,
                    total: tot
                };
            }
            return null;
        })
        .filter(Boolean);
}

window.generateInvoice = async (leadData, items = [], depositAmount = 0, taxId = '') => {
    const L = leadData && typeof leadData === 'object' ? leadData : {};
    const C = MDJ_INVOICE_COMPANY;

    const nameRaw = (L.name || L.full_name || L.contact_person || L.client_name || '').toString().trim();
    const companyRaw = (
        L.client_company_name ||
        L.renting_company ||
        L.company_name ||
        L.bill_to_company ||
        ''
    )
        .toString()
        .trim();
    const eventNameRaw = (L.event_name || L.event_title || L.job_name || L.event_type || '').toString().trim();

    const venueRaw = (
        L.event_location ||
        L.venue ||
        L.venue_address ||
        L.event_address ||
        L.service_location ||
        L.location ||
        ''
    )
        .toString()
        .trim();

    const billingRaw = (
        L.client_billing_address ||
        L.billing_address ||
        L.client_address ||
        L.company_address ||
        L.corporate_address ||
        L.client_company_address ||
        L.employer_address ||
        ''
    )
        .toString()
        .trim();

    const timeRaw = (L.event_time || L.event_start_time || L.start_time || '').toString().trim();
    var taxRate = parseFloat(L.tax_rate);
    if (isNaN(taxRate) || taxRate < 0 || taxRate > 0.5) taxRate = MDJ_INVOICE_TAX_RATE;

    const sellerEin = mdjResolveSellerEin(L);
    const invoiceDateStr =
        (L.invoice_date && String(L.invoice_date).trim()) ||
        new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

    leadData = {
        id: L.id != null ? L.id : '—',
        name: nameRaw,
        client_company_name: companyRaw,
        email: (L.email && String(L.email).trim()) || '—',
        event_name: eventNameRaw,
        event_type: (L.event_type && String(L.event_type)) || 'Event',
        event_date: (L.event_date && String(L.event_date)) || new Date().toISOString().slice(0, 10),
        event_time: timeRaw,
        event_location: venueRaw || '—',
        location: venueRaw || (L.location && String(L.location)) || '—',
        client_billing_address: billingRaw || '—',
        tax_rate: taxRate,
        seller_ein: sellerEin,
        invoice_date: invoiceDateStr
    };

    var buyerTaxShow =
        taxId != null &&
        String(taxId).trim() !== '' &&
        String(taxId).trim().toUpperCase() !== 'N/A'
            ? String(taxId).trim()
            : '';

    var logoDataUrl = null;
    try {
        logoDataUrl = await mdjFetchInvoiceLogoDataUrl();
    } catch (e) {
        logoDataUrl = null;
    }

    var jspdfMod = typeof window !== 'undefined' ? window.jspdf : null;
    if (!jspdfMod || typeof jspdfMod.jsPDF !== 'function') {
        throw new Error(
            'jsPDF no está cargado. Necesitas internet para el CDN o recarga la página. Si abres el HTML con file://, usa un servidor local (ej. npx serve web).'
        );
    }
    const { jsPDF } = jspdfMod;
    const doc = new jsPDF();

    const corporateColor = [26, 43, 86];
    const goldRgb = [197, 160, 89];

    doc.saveGraphicsState();
    doc.setTextColor(220, 220, 220);
    doc.setFontSize(72);
    doc.setFont('Helvetica', 'bold');
    doc.setGState(new doc.GState({ opacity: 0.06 }));
    doc.text('MIAMI DJ BEAT', 105, 165, { align: 'center', angle: 35 });
    doc.restoreGraphicsState();

    const logoW = 38;
    const logoH = 38;
    const logoTop = 12;
    const logoLeft = 20;
    var invoiceLogoOk = false;
    if (logoDataUrl) {
        try {
            doc.addImage(logoDataUrl, 'PNG', logoLeft, logoTop, logoW, logoH);
            invoiceLogoOk = true;
        } catch (e) {
            invoiceLogoOk = false;
        }
    }
    if (!invoiceLogoOk) {
        doc.setTextColor(goldRgb[0], goldRgb[1], goldRgb[2]);
        doc.setFontSize(16);
        doc.setFont('Helvetica', 'bold');
        doc.text(C.legalName, 20, 26);
        doc.setFontSize(7);
        doc.setFont('Helvetica', 'normal');
        doc.text(C.tagline, 20, 32);
    }

    doc.setTextColor(0);
    doc.setFontSize(34);
    doc.setFont('Helvetica', 'bold');
    doc.text('INVOICE', 190, 24, { align: 'right' });
    doc.setFontSize(7);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(90, 90, 90);
    doc.text('Tax: FL est. · Retain for your records', 190, 31, { align: 'right' });

    var ry = 38;
    doc.setTextColor(0);
    doc.setFontSize(9);
    doc.setFont('Helvetica', 'bold');
    if (!invoiceLogoOk) {
        doc.text(C.legalName, 190, ry, { align: 'right' });
        ry += 4.5;
    }
    doc.setFont('Helvetica', 'normal');
    doc.text(C.addressLine1 + ', ' + C.addressLine2, 190, ry, { align: 'right' });
    ry += 4.5;
    doc.text('Phone: ' + C.phone, 190, ry, { align: 'right' });
    ry += 4.5;
    doc.text('Mail: ' + C.email, 190, ry, { align: 'right' });
    ry += 4.5;
    doc.text('Web: ' + C.web, 190, ry, { align: 'right' });
    ry += 4.5;
    if (sellerEin) {
        doc.setFont('Helvetica', 'bold');
        doc.text('Tax ID (EIN): ' + sellerEin, 190, ry, { align: 'right' });
        doc.setFont('Helvetica', 'normal');
        ry += 4.5;
    }

    const blockY = Math.max(ry + 5, 58);
    doc.setDrawColor(goldRgb[0], goldRgb[1], goldRgb[2]);
    doc.setLineWidth(0.35);
    doc.line(20, blockY, 190, blockY);

    const lh = 5.5;
    var y = blockY + 8;
    doc.setFontSize(10);
    doc.setFont('Helvetica', 'bold');
    doc.text('Invoice No.', 20, y);
    doc.text('Customer ID:', 20, y + lh);
    doc.text('Customer:', 20, y + lh * 2);
    doc.setFont('Helvetica', 'normal');
    const invNum = 'INV-' + Date.now().toString().slice(-8);
    doc.text(invNum, 52, y);
    doc.text(String(leadData.id || 'N/A'), 52, y + lh);
    const custLine =
        leadData.name && leadData.name !== ''
            ? leadData.name + (leadData.email && leadData.email !== '—' ? ' · ' + leadData.email : '')
            : leadData.email;
    doc.text(doc.splitTextToSize(custLine, 75), 52, y + lh * 2);
    const custH = Math.max(lh, doc.splitTextToSize(custLine, 75).length * 4.2);
    y += lh * 2 + custH + 4;

    const billX = 20;
    const shipX = 108;
    const colW = 82;
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(corporateColor[0], corporateColor[1], corporateColor[2]);
    doc.text('Bill To:', billX, y);
    doc.text('Ship To: (event / service location)', shipX, y);
    doc.setTextColor(0);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    y += lh;

    var billBlock =
        (leadData.client_company_name ? leadData.client_company_name + '\n' : '') +
        (leadData.client_billing_address && leadData.client_billing_address !== '—'
            ? leadData.client_billing_address
            : '—');
    var shipBlock =
        (leadData.event_name && leadData.event_name !== '' ? leadData.event_name + '\n' : '') +
        (leadData.event_date || '') +
        (leadData.event_time ? ' · ' + leadData.event_time : '') +
        '\n' +
        (leadData.event_location && leadData.event_location !== '—' ? leadData.event_location : '—');

    const billLines = doc.splitTextToSize(billBlock, colW);
    const shipLines = doc.splitTextToSize(shipBlock, colW);
    doc.text(billLines, billX, y);
    doc.text(shipLines, shipX, y);
    y += Math.max(billLines.length, shipLines.length) * 4.2 + 10;

    const metaTop = y;
    const metaH = 17;
    doc.setFillColor(245, 245, 247);
    doc.rect(20, metaTop, 170, metaH, 'F');
    doc.setDrawColor(200, 200, 210);
    doc.rect(20, metaTop, 170, metaH, 'S');
    doc.setFontSize(7);
    doc.setFont('Helvetica', 'bold');
    const mh = ['Date', 'Order No.', 'Sales Rep.', 'FOB', 'Ship Via', 'Terms', 'Tax ID'];
    var mx = 21;
    const mw = [24, 24, 22, 18, 22, 22, 30];
    mh.forEach(function (h, i) {
        doc.text(h, mx, metaTop + 5);
        mx += mw[i];
    });
    doc.setFont('Helvetica', 'normal');
    const metaRowY = metaTop + 12;
    var vx = 21;
    doc.text(new Date().toLocaleDateString(), vx, metaRowY);
    vx += mw[0];
    doc.text(leadData.id ? String(leadData.id).slice(0, 10) : 'N/A', vx, metaRowY);
    vx += mw[1];
    doc.text('MDJ', vx, metaRowY);
    vx += mw[2];
    doc.text('Miami', vx, metaRowY);
    vx += mw[3];
    doc.text('Local', vx, metaRowY);
    vx += mw[4];
    doc.text('Due on receipt', vx, metaRowY);
    vx += mw[5];
    doc.text(buyerTaxShow || sellerEin || '—', vx, metaRowY, { maxWidth: mw[6] - 2 });

    y = metaTop + metaH + 5;

    const startY = y;
    doc.setFillColor(235, 237, 245);
    doc.rect(20, startY, 170, 9, 'F');
    doc.line(20, startY, 190, startY);
    doc.line(20, startY + 9, 190, startY + 9);
    doc.setFontSize(8);
    doc.setFont('Helvetica', 'bold');
    const mainHeaders = ['Equip', 'Model', 'Date', 'Tracking', 'Tax', 'Unit', 'Total'];
    const colWidths = [38, 26, 22, 30, 14, 14, 18];
    var mX = 22;
    mainHeaders.forEach(function (h, i) {
        doc.text(h, mX, startY + 6);
        mX += colWidths[i];
    });

    var currentY = startY + 9;
    let subtotal = 0;

    const normalized = mdjNormalizeInvoiceItems(items, leadData);
    const taxColDefault = mdjInvoiceTaxColPercent(leadData);
    const displayItems =
        normalized.length > 0
            ? normalized
            : [
                  {
                      equip: '(Add line items)',
                      model: '—',
                      date: leadData.event_date || 'TBD',
                      tracking: '—',
                      tax: taxColDefault,
                      unit: 0,
                      total: 0
                  }
              ];

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    displayItems.forEach(function (item) {
        doc.line(20, currentY, 190, currentY);
        var iX = 22;
        var eLines = doc.splitTextToSize(item.equip.toString(), colWidths[0] - 2);
        doc.text(eLines, iX, currentY + 5);
        iX += colWidths[0];
        doc.text(item.model.toString().slice(0, 18), iX, currentY + 5);
        iX += colWidths[1];
        doc.text(item.date.toString().slice(0, 12), iX, currentY + 5);
        iX += colWidths[2];
        doc.text(item.tracking.toString().slice(0, 16), iX, currentY + 5);
        iX += colWidths[3];
        doc.text(item.tax.toString(), iX, currentY + 5);
        iX += colWidths[4];
        doc.text('$' + item.unit.toFixed(2), iX, currentY + 5);
        iX += colWidths[5];
        doc.text('$' + item.total.toFixed(2), iX, currentY + 5);
        subtotal += item.total;
        var rowH = Math.max(8, eLines.length * 3.8 + 4);
        currentY += rowH;
        doc.line(20, currentY, 190, currentY);
    });

    for (var pad = 0; pad < 4; pad++) {
        doc.line(20, currentY, 190, currentY);
        currentY += 8;
        doc.line(20, currentY, 190, currentY);
    }

    const r = leadData.tax_rate;
    const taxAmt = subtotal * r;
    const shipping = 0;
    const grandTotal = subtotal + taxAmt + shipping;
    const dep = Number(depositAmount) || 0;
    const balanceDue = grandTotal - dep;
    const pctLabel = Math.round(r * 1000) / 10;

    const totalY = currentY + 8;
    const labelX = 128;
    const summary = [
        { label: 'Subtotal:', val: subtotal },
        { label: 'Tax (' + pctLabel + '% FL est.):', val: taxAmt },
        { label: 'Shipping:', val: shipping },
        { label: 'Total:', val: grandTotal, bold: true },
        { label: 'Less deposit / paid:', val: -dep, color: [180, 0, 0] },
        { label: 'Balance Due:', val: balanceDue, bold: true, color: corporateColor }
    ];

    summary.forEach(function (s, i) {
        doc.setDrawColor(210, 210, 220);
        doc.rect(labelX, totalY + i * 7.5, 62, 7.5, 'S');
        doc.setFont('Helvetica', s.bold ? 'bold' : 'normal');
        if (s.color) doc.setTextColor(s.color[0], s.color[1], s.color[2]);
        else doc.setTextColor(0);
        doc.setFontSize(8);
        doc.text(s.label, labelX + 1.5, totalY + i * 7.5 + 5);
        doc.text('$' + s.val.toFixed(2), labelX + 59, totalY + i * 7.5 + 5, { align: 'right' });
    });
    doc.setTextColor(0);

    const footY = totalY + summary.length * 7.5 + 10;
    doc.setFontSize(7.5);
    doc.setTextColor(75, 75, 75);
    doc.text(
        'Sales tax shown is an estimate for Florida taxable services/rentals; confirm jurisdiction with your CPA.',
        20,
        footY,
        { maxWidth: 170 }
    );
    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.setFont('Helvetica', 'italic');
    doc.text(
        "Thank You For Business It's a Pleasure to work with you on your project.",
        20,
        footY + 10
    );
    doc.setFont('Helvetica', 'normal');
    doc.text('Sincerely,', 20, footY + 18);
    doc.text('Gerardo A Valle', 20, footY + 25);

    doc.save('Invoice_' + (leadData.id !== '—' ? leadData.id : 'MDJ') + '_' + Date.now() + '.pdf');
};
