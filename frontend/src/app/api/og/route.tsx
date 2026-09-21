import { ImageResponse } from 'next/og';

export const runtime = 'edge';

// Force edge rendering to be dynamic, not static
export const dynamic = 'force-dynamic';

export async function GET() {
  const apiUrl = process.env.INTERNAL_API_URL || "http://backend:5000";
  
  let minutesToMidnight = 23.4; // Graceful fallback
  let stressScore = 75.0;
  let tcDate = "2027-03-12";
  let dataQuality = "degraded";
  const today = new Date().toISOString().split("T")[0];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
    
    console.log(`[OG Image] Fetching live data from: ${apiUrl}/api/v1/clock`);
    const response = await fetch(`${apiUrl}/api/v1/clock`, { 
      signal: controller.signal,
      cache: 'no-store'
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      minutesToMidnight = data.minutes_to_midnight;
      stressScore = data.stress_score;
      // Extract just the YYYY-MM-DD part from the ISO string
      tcDate = data.tc_date ? data.tc_date.split("T")[0] : tcDate;
      dataQuality = data.data_quality;
      console.log(`[OG Image] Successfully fetched live data.`);
    } else {
      console.log(`[OG Image] Fetch failed with status: ${response.status}`);
    }
  } catch (error) {
    console.error("[OG Image] Failed to fetch live clock data. Using fallback.", error);
  }

  // Determine color based on hours (0-12 scale)
  let color = "#10B981"; // Green
  if (minutesToMidnight <= 8) color = "#F59E0B"; // Amber
  if (minutesToMidnight <= 4) color = "#FF3B3B"; // Red

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          backgroundColor: '#0B0E14',
          color: '#ffffff',
          fontFamily: '"Inter", sans-serif',
          backgroundImage: 'linear-gradient(to bottom right, #111520, #0B0E14)',
        }}
      >
        {/* Left Side - Clock Face */}
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            position: 'relative',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            border: '8px solid #1E293B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0F172A',
            boxShadow: '0 0 40px rgba(0,0,0,0.5)',
          }}>
             {/* Center dot */}
             <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: color, position: 'absolute', zIndex: 10 }} />
             
             {/* Hour Hand (Fixed at 12) */}
             <div style={{
                position: 'absolute',
                width: '12px',
                height: '160px',
                backgroundColor: '#334155',
                bottom: '50%',
                left: '194px',
                borderRadius: '6px',
             }} />

             {/* Minute Hand (Dynamic) -> now 12 hours scale */}
             <div style={{
                position: 'absolute',
                width: '8px',
                height: '180px',
                backgroundColor: color,
                bottom: '50%',
                left: '196px',
                transformOrigin: 'bottom',
                transform: `rotate(${((12 - minutesToMidnight) / 12) * 360}deg)`,
                borderRadius: '4px',
                boxShadow: `0 0 15px ${color}`,
             }} />
          </div>
        </div>

        {/* Right Side - Typography & Data */}
        <div style={{ 
            display: 'flex', 
            flex: 1.5, 
            flexDirection: 'column', 
            justifyContent: 'center',
            padding: '40px',
            paddingRight: '60px',
        }}>
          <h1 style={{ 
              fontSize: '48px', 
              fontWeight: 800, 
              color: '#F8FAFC',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              margin: '0 0 20px 0',
          }}>
            AI Bubble Doomsday Clock
          </h1>

          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '12px',
            fontSize: '72px',
            fontWeight: 800,
            color: color,
            marginBottom: '30px',
            lineHeight: 1,
            textShadow: `0 0 20px ${color}40`,
          }}>
            <span>{minutesToMidnight.toFixed(1)}</span> <span style={{ fontSize: '40px', color: '#94A3B8' }}>HOURS</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
             <div style={{ display: 'flex', alignItems: 'center' }}>
               <span style={{ fontSize: '24px', color: '#64748B', width: '250px' }}>Macro Stress Index:</span>
               <span style={{ fontSize: '32px', color: '#F1F5F9', fontWeight: 600 }}>{stressScore.toFixed(1)}</span>
             </div>
             
             <div style={{ display: 'flex', alignItems: 'center' }}>
               <span style={{ fontSize: '24px', color: '#64748B', width: '250px' }}>Predicted Crash (T_c):</span>
               <span style={{ fontSize: '32px', color: '#F1F5F9', fontWeight: 600 }}>{tcDate}</span>
             </div>
          </div>

          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginTop: 'auto',
            borderTop: '2px solid #1E293B',
            paddingTop: '20px'
          }}>
            <span style={{ fontSize: '20px', color: '#475569' }}>
               aibubbleclock.com • Econophysics Model • NFA
            </span>
            <span style={{ fontSize: '20px', color: '#475569' }}>
               Updated: {today}
            </span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=600',
      },
    }
  );
}
