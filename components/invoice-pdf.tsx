'use client';
import { Document, Page, Text, View, Image, StyleSheet, pdf } from '@react-pdf/renderer';
import { invoiceAppearance, invoiceNumber, money, totals, type Invoice, type Profile } from '../lib/invoice';
export type PdfProps = {invoice:Invoice;profile:Profile;logoUrl?:string;number:number|null};
const styles=StyleSheet.create({
  page:{padding:38,fontSize:10,lineHeight:1.35,color:'#202a29'}, title:{fontSize:29}, heading:{fontSize:15,fontWeight:700},
  row:{flexDirection:'row',justifyContent:'space-between',gap:12}, item:{paddingVertical:8,paddingHorizontal:6,borderBottomWidth:1,borderBottomColor:'#dedede'},
  cell:{width:'18%',textAlign:'right'}, desc:{flexGrow:1,flexBasis:0}, block:{marginBottom:20}, small:{fontSize:8}, logo:{width:78,height:42,objectFit:'contain',marginBottom:12},
  totals:{width:'50%',alignSelf:'flex-end',marginTop:12}, total:{padding:8,marginTop:6,color:'#fff'},
});
function InvoiceDocument({invoice,profile,logoUrl,number}:PdfProps) {
  const {template:design,accent:color,onAccent,infoSize}=invoiceAppearance(invoice);
  const sum=totals(invoice);
  const m=(v:Parameters<typeof money>[0])=>money(v,invoice.currency);
  const letterhead=design.id==='letterhead';
  const accent=design.id==='accent';
  const ledger=design.id==='ledger';
  const studio=design.id==='studio';
  return <Document title={invoiceNumber(number)+' — '+profile.name}>
    <Page size="A4" style={styles.page}>
      {logoUrl && <View style={{alignItems:invoice.logoPosition==='center'?'center':invoice.logoPosition==='right'?'flex-end':'flex-start'}}><Image src={logoUrl} style={styles.logo}/></View>}
      <View style={[styles.block,{flexDirection:letterhead?'column':studio?'row-reverse':'row',alignItems:letterhead?'center':'flex-start',justifyContent:'space-between',borderTopWidth:design.id==='essential'?4:0,borderTopColor:color,paddingTop:accent?14:design.id==='essential'?10:0,backgroundColor:accent?color:'#fff',color:accent?onAccent:'#202a29',paddingHorizontal:accent?14:0,paddingBottom:accent?14:0,borderBottomWidth:studio?3:letterhead?1:0,borderBottomColor:color}]}>
        <Text style={styles.heading}>{profile.name || 'Your business'}</Text><View><Text style={styles.title}>Invoice</Text><Text>{invoiceNumber(number)}</Text></View>
      </View>
      <View style={[styles.block,{flexDirection:invoice.addressLayout==='columns'?'row':'column',gap:14,fontSize:infoSize}]}>
        <View style={{flex:1}}><Text style={styles.small}>FROM</Text>
          {[profile.legalName || profile.name,profile.address,profile.country,profile.email,profile.phone,profile.website,profile.registration && 'Registration: '+profile.registration,profile.taxId && 'Tax ID: '+profile.taxId].filter(Boolean).map((v,i)=><Text key={i}>{v}</Text>)}</View>
        <View style={{flex:1}}><Text style={styles.small}>BILL TO</Text><Text>{invoice.client}</Text><Text>{invoice.clientAddress}</Text><Text>{invoice.clientEmail}</Text>{invoice.clientTaxId && <Text>Tax ID: {invoice.clientTaxId}</Text>}</View>
      </View>
      <View style={[styles.row,styles.block]}><Text>Issued: {invoice.date || '—'}</Text><Text>Due: {invoice.due || '—'}</Text></View>
      <View style={[styles.row,styles.item,{backgroundColor:ledger?color:'#eef2f0',color:ledger?onAccent:'#202a29'}]}><Text style={styles.desc}>Description</Text><Text style={styles.cell}>Quantity</Text><Text style={styles.cell}>Unit price</Text><Text style={styles.cell}>Amount</Text></View>
      {invoice.items.map((item,i)=><View key={i} wrap={false} style={[styles.row,styles.item,{backgroundColor:ledger && i%2===0?'#edf3f8':'#fff'}]}><Text style={styles.desc}>{item.description || '—'}</Text><Text style={styles.cell}>{item.quantity}</Text><Text style={styles.cell}>{m(item.unitPrice || 0)}</Text><Text style={styles.cell}>{m(sum.lines[i])}</Text></View>)}
      <View style={styles.totals} wrap={false}>
        <View style={styles.row}><Text>Subtotal</Text><Text>{m(sum.subtotal)}</Text></View>
        {sum.discount.gt(0) && <View style={styles.row}><Text>Discount</Text><Text>{m(sum.discount.negated())}</Text></View>}
        {invoice.taxEnabled && <View style={styles.row}><Text>{invoice.taxLabel || 'Tax'}</Text><Text>{m(sum.tax)}</Text></View>}
        <View style={[styles.row,styles.total,{backgroundColor:color,color:onAccent}]}><Text>Amount due</Text><Text>{m(sum.total)}</Text></View>
      </View>
      {[['Payment instructions',invoice.payment],['Notes',invoice.notes]].map(([label,value])=>value && <View key={label} style={{marginTop:16}}><Text style={styles.heading}>{label}</Text><Text>{value}</Text></View>)}
      <View wrap={false} style={{marginTop:24,paddingTop:9,borderTopWidth:1,borderTopColor:color,fontSize:8,flexDirection:letterhead?'column':'row',alignItems:letterhead?'center':'flex-start',justifyContent:'space-between',gap:10}}>
        <Text>{invoice.footer?.trim() || profile.legalName || profile.name || 'Thank you for your business.'}</Text><Text>{invoiceNumber(number)}</Text>
      </View>
    </Page>
  </Document>;
}
export function createInvoicePdf(props:PdfProps) {
  return pdf(<InvoiceDocument {...props}/>).toBlob();
}
