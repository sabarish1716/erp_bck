const fs = require('fs');
let c = fs.readFileSync('src/fees/fees.service.ts', 'utf8');
c = c.replace(
`    let discountAmount = 0;
    for (const d of allDiscounts) {
      if (d.type === DiscountType.FLAT) {
        discountAmount += d.value;`,
`    let discountAmount = 0;
    for (const d of allDiscounts) {
      const isFlatComputed = d.reason && d.reason.includes('[Pct:');
      if (d.type === DiscountType.FLAT || isFlatComputed) {
        discountAmount += d.value;`
);
fs.writeFileSync('src/fees/fees.service.ts', c);
