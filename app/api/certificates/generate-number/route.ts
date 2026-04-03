import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase'

export async function GET() {
  try {
    const currentYear = new Date().getFullYear();
    const currentMonthIndex = new Date().getMonth();
    const romanMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    const romanMonth = romanMonths[currentMonthIndex];
    
    // Fetch certificates for the current year to find max order number
    const { data, error } = await supabaseAdmin
      .from('certificate')
      .select('no_order')
      .gte('created_at', `${currentYear}-01-01T00:00:00.000Z`)
      .lte('created_at', `${currentYear}-12-31T23:59:59.999Z`);
      
    if (error) {
      console.error('Failed to fetch certificates:', error);
      return NextResponse.json({ error: 'Failed to fetch certificate numbers' }, { status: 500 });
    }

    let maxOrder = 0;
    if (data && data.length > 0) {
      data.forEach((cert) => {
        // We only parse digits, in case no_order contains non-digit chars
        const orderMatch = (cert.no_order || '').match(/\d+/);
        if (orderMatch) {
          const orderNum = parseInt(orderMatch[0], 10);
          if (!isNaN(orderNum) && orderNum > maxOrder) {
            maxOrder = orderNum;
          }
        }
      });
    }

    const nextOrder = maxOrder + 1;
    const paddedOrder = nextOrder.toString().padStart(3, '0');
    
    // Format: SERT.FC.AWS/123/DIK/III/2026
    const no_certificate = `SERT.FC.AWS/${paddedOrder}/DIK/${romanMonth}/${currentYear}`;

    return NextResponse.json({ 
      no_order: paddedOrder,
      no_certificate: no_certificate
    });

  } catch (e: any) {
    console.error('Error generating certificate number:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
