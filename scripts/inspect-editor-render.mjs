// Replicate the editor's call to renderSoctivIndexPreview and inspect the output
import { renderSoctivIndexPreview } from '../src/services/soctivLandingPreview.ts';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const config = {
  product: { id:'p-001', code:'WT-LIB-001', name:'saffron', nameArabic:'زعفران أصلي', image:'https://images.unsplash.com/photo-1610725663727-08695a1ac3ff?w=1200', currency:'LYD', currencySymbol:'د.ل', currencyName:'دينار ليبي', value:99, unitPrice:99, category:'عطاريات', metaLine:'دفع عند الاستلام · توصيل مجاني' },
  pricing: { tiers:[{quantity:1,price:99,label:'قطعة واحدة'},{quantity:2,price:179,label:'قطعتان'},{quantity:3,price:249,label:'ثلاث قطع'},{quantity:4,price:299,label:'أربع قطع'},{quantity:5,price:349,label:'خمس قطع'}], maxQty:5, discountLabel:'التخفيض' },
  tracking: { pixelId:'', capiUrl:'https://x.supabase.co/functions/v1/capi-proxy', testEventCode:'', debug:false },
  hero: { headline:'عزز فرصك في النجاح بطريقة طبيعية وفاخرة', subline:'أساعدك لتعزيز حضورك بمشروب أصيل يُبرز تميّزك.', ctaText:'اطلب منتج الزعفران — الدفع عند الاستلام', imageUrl:'https://images.unsplash.com/photo-1610725663727-08695a1ac3ff?w=1040&q=80', imageAlt:'زعفران أصلي' },
  form: { submitText:'تأكيد الطلب', nameField:'الاسم الكامل', phoneField:'رقم الهاتف', locationField:'المدينة والعنوان', phoneRegex:'^09[0-9]{8}$', phonePlaceholder:'091 234 5678', nameMinLength:3, locationMinLength:5, submittingText:'جاري الإرسال…' },
  objections: { heading:'أسئلة شائعة', subheading:'إجابات مباشرة', items:[{q:'سؤال',a:'جواب'}] },
  reviews: { heading:'آراء العملاء', subheading:'تجارب', items:[{name:'أحمد',location:'طرابلس',text:'ممتاز',initial:'أ'}] },
  trust: { badges:['دفع عند الاستلام','توصيل مجاني','ضمان سنة'], row:['دفع عند الاستلام','توصيل مجاني'] },
  business: { brand:'soctiv', supportEmail:'support@soctiv.ly', privacyEmail:'privacy@soctiv.ly', country:'Libya', phonePrefix:'+218', copyright:'جميع الحقوق محفوظة', brandInitial:'s' },
  webhook: { url:'https://x.supabase.co/functions/v1/facebook-leads-webhook', clientCode:'', productCode:'', thankYouUrl:'thank-you.html', source:'Landing Page' },
  seo: { title:'زعفران', description:'زعفران أصلي', ogImage:'', ogImageAlt:'', year:'2026' },
  theme: { palette:'cream-sage', font:'Alexandria' }
};

const html = renderSoctivIndexPreview(config, { supabaseUrl:'https://x.supabase.co', year:'2026', noopPixel:false });
writeFileSync(resolve(process.cwd(), 'dist/editor-preview.html'), html);
console.log('Length:', html.length);
console.log('Script tags:', (html.match(/<script/g) || []).length);
console.log('Style tags:', (html.match(/<style/g) || []).length);
console.log('runtime.js src present:', html.includes('src="runtime.js"'));
console.log('link rel=stylesheet present:', html.includes('<link rel="stylesheet" href="styles.css"'));
// Find any place where "startsWith" appears as visible text (not in a script):
const visibleStartsWith = html.match(/>[^<]*startsWith[^<]*</g);
console.log('Visible-text startsWith matches:', visibleStartsWith ? visibleStartsWith.length : 0);
if (visibleStartsWith) console.log('Sample:', visibleStartsWith[0]?.slice(0, 200));
// Find any </script> in unexpected places
const scriptCloses = [...html.matchAll(/<\/script>/g)];
console.log('Total </script> count:', scriptCloses.length);
for (const m of scriptCloses) {
  console.log('  at offset', m.index, ':', JSON.stringify(html.substring(m.index - 30, m.index + 15)));
}
