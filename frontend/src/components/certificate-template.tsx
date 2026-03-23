import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export type CertificateData = {
    name: string;
    email: string;
    studentId: string;
    course: string;
    issuer: string;
    date: string;
    certificateId: string;
    network: string;
    signature?: string;
    qrCode?: string;
};

interface CertificateTemplateProps {
    data: CertificateData;
    className?: string;
    id?: string;
}

const S = "'Playfair Display', 'Georgia', serif";
const N = "'Inter', 'Helvetica Neue', sans-serif";

const CertificateTemplate = forwardRef<HTMLDivElement, CertificateTemplateProps>(
    ({ data, className, id }, ref) => {
        const d = {
            name: data.name || "Recipient Name",
            course: data.course || "Course Name",
            issuer: data.issuer || "Issuer",
            date: data.date || "March 19, 2026",
            certificateId: data.certificateId || "CERT-MMXLK95Q-F5NH",
            network: data.network || "Sepolia",
            signature: data.signature,
            qrCode: data.qrCode,
        };

        return (
            <div id={id} ref={ref} className={cn("relative mx-auto", className)} style={{ position: "relative", width: 760, height: 900, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40' width='40' height='40'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.5' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.05'/%3E%3C/svg%3E"), radial-gradient(ellipse at 15% 15%, #ffffff 0%, #faf9f5 30%, #eeebe0 65%, #dfdacb 100%)`, backgroundSize: '40px 40px, auto', backgroundRepeat: 'repeat, no-repeat', backgroundBlendMode: 'color-burn, normal', boxShadow: 'inset 0 0 160px rgba(0,0,0,0.08), inset 0 0 60px rgba(120,100,70,0.05), inset 0 0 8px rgba(0,0,0,0.1), -1px -1px 1px rgba(255,255,255,0.9), 1px 1px 1px rgba(255,255,255,0.4), 0 10px 30px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08)', overflow: "hidden", fontFamily: N, textShadow: '0 0 0.3px currentColor, 0 0.5px 0.5px rgba(0,0,0,0.15)' }}>
                {/* Corner crosshatch patterns */}
                {(['top:7px;left:7px', 'top:7px;right:7px', 'bottom:7px;left:7px', 'bottom:7px;right:7px'] as const).map((pos, i) => {
                    const style: React.CSSProperties = { position: 'absolute', width: 300, height: 300, zIndex: 2, pointerEvents: 'none', background: `repeating-linear-gradient(45deg, transparent, transparent 24px, rgba(160,148,128,0.28) 24px, rgba(160,148,128,0.28) 25px), repeating-linear-gradient(-45deg, transparent, transparent 24px, rgba(160,148,128,0.28) 24px, rgba(160,148,128,0.28) 25px)`, WebkitMaskImage: `radial-gradient(circle at ${i % 2 === 0 ? '0% ' : '100% '}${i < 2 ? '0%' : '100%'}, black 15%, transparent 70%)`, maskImage: `radial-gradient(circle at ${i % 2 === 0 ? '0% ' : '100% '}${i < 2 ? '0%' : '100%'}, black 15%, transparent 70%)` };
                    if (i < 2) style.top = 7; else style.bottom = 7;
                    if (i % 2 === 0) style.left = 7; else style.right = 7;
                    return <div key={i} data-html2canvas-ignore="true" style={style} />;
                })}
                <div style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none", backgroundImage: `url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCA4MDAgODAwJyB3aWR0aD0nODAwJyBoZWlnaHQ9JzgwMCc+PGZpbHRlciBpZD0nZic+PGZlVHVyYnVsZW5jZSB0eXBlPSdmcmFjdGFsTm9pc2UnIGJhc2VGcmVxdWVuY3k9JzAuMDMgMC42JyBudW1PY3RhdmVzPSczJyByZXN1bHQ9J24xJy8+PGZlQ29sb3JNYXRyaXggdHlwZT0nbWF0cml4JyB2YWx1ZXM9JzAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDQwIC0yMCcgaW49J24xJyByZXN1bHQ9J2YxJy8+PGZlVHVyYnVsZW5jZSB0eXBlPSdmcmFjdGFsTm9pc2UnIGJhc2VGcmVxdWVuY3k9JzAuNyAwLjAyJyBudW1PY3RhdmVzPSczJyByZXN1bHQ9J24yJy8+PGZlQ29sb3JNYXRyaXggdHlwZT0nbWF0cml4JyB2YWx1ZXM9JzAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDQwIC0yMCcgaW49J24yJyByZXN1bHQ9J2YyJy8+PGZlTWVyZ2U+PGZlTWVyZ2VOb2RlIGluPSdmMScvPjxmZU1lcmdlTm9kZSBpbj0nZjInLz48L2ZlTWVyZ2U+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9JzEwMCUnIGhlaWdodD0nMTAwJScgZmlsdGVyPSd1cmwoI2YpJyBvcGFjaXR5PScwLjAyJy8+PC9zdmc+")`, mixBlendMode: "color-burn" }} />
                <div style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none", background: "radial-gradient(circle at 0% 0%, rgba(255,255,255,0.4) 0%, transparent 40%), linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 50%)" }} />
                <div style={{ position: 'absolute', top: 7, left: 7, right: 7, height: 2, background: 'linear-gradient(to right, #FFF3B0 0%, #F5D77A 15%, #C9A646 35%, #B8962E 50%, #FFF3B0 60%, #F5D77A 75%, #B8962E 100%)', pointerEvents: 'none', zIndex: 5 }} />
                <div style={{ position: 'absolute', bottom: 7, left: 7, right: 7, height: 2, background: 'linear-gradient(to right, #FFF3B0 0%, #F5D77A 15%, #C9A646 35%, #B8962E 50%, #FFF3B0 60%, #F5D77A 75%, #B8962E 100%)', pointerEvents: 'none', zIndex: 5 }} />
                <div style={{ position: 'absolute', top: 7, bottom: 7, left: 7, width: 2, background: 'linear-gradient(to bottom, #FFF3B0 0%, #F5D77A 15%, #C9A646 35%, #B8962E 50%, #FFF3B0 60%, #F5D77A 75%, #B8962E 100%)', pointerEvents: 'none', zIndex: 5 }} />
                <div style={{ position: 'absolute', top: 7, bottom: 7, right: 7, width: 2, background: 'linear-gradient(to bottom, #FFF3B0 0%, #F5D77A 15%, #C9A646 35%, #B8962E 50%, #FFF3B0 60%, #F5D77A 75%, #B8962E 100%)', pointerEvents: 'none', zIndex: 5 }} />
                <div style={{ position: 'absolute', top: 7, left: 7, right: 7, bottom: 7, pointerEvents: 'none', zIndex: 5, boxShadow: '-1px -1px 1px rgba(255,255,255,0.7), 1px 1px 2px rgba(0,0,0,0.3), inset 1px 1px 2px rgba(0,0,0,0.3), inset -1px -1px 1px rgba(255,255,255,0.7)' }} />
                <div style={{ position: 'absolute', top: 14, left: 14, right: 14, bottom: 14, border: '1px solid rgba(0,0,0,0.05)', pointerEvents: 'none', zIndex: 5 }} />
                <div style={{ position: 'absolute', top: 20, left: 20, right: 20, bottom: 20, border: '1px solid rgba(200,170,90,0.3)', pointerEvents: 'none', zIndex: 5 }} />

                <div style={{ position: "absolute", top: 0, left: 0, width: "100%", zIndex: 4, pointerEvents: "none" }}>
                    <svg viewBox="0 0 742 300" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "auto", display: "block" }}>
                    <defs>
                        <linearGradient id="navyGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#0A1F3B" />
                            <stop offset="40%" stopColor="#0A1F3B" />
                            <stop offset="75%" stopColor="#0A1F3B" />
                            <stop offset="100%" stopColor="#0A1F3B" />
                        </linearGradient>
                        <linearGradient id="goldFoil" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#FFF3B0" />
                            <stop offset="12%" stopColor="#F5D77A" />
                            <stop offset="35%" stopColor="#C9A646" />
                            <stop offset="48%" stopColor="#B8962E" />
                            <stop offset="52%" stopColor="#FFF3B0" />
                            <stop offset="68%" stopColor="#F5D77A" />
                            <stop offset="85%" stopColor="#C9A646" />
                            <stop offset="100%" stopColor="#B8962E" />
                        </linearGradient>
                        <filter id="inkBleed" x="-20%" y="-20%" width="140%" height="140%">
                            <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="3" result="noise" />
                            <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.8" xChannelSelector="R" yChannelSelector="G" result="displaced" />
                            <feGaussianBlur in="displaced" stdDeviation="0.2" />
                        </filter>
                    </defs>
                    <path d="M0,0 L742,0 L742,160 Q371,-116 0,160 Z" fill="#0A1F3B" />
                    <path d="M0,160 Q371,-116 742,160" fill="none" stroke="url(#goldFoil)" strokeWidth="2" opacity="0.9" style={{ filter: 'drop-shadow(-1px -1px 1px rgba(255,255,255,0.7)) drop-shadow(1px 1px 2px rgba(0,0,0,0.3))' }} />
                    <path d="M0,170 Q371,-110 742,170" fill="none" stroke="url(#goldFoil)" strokeWidth="1.2" opacity="0.5" />
                    <path d="M0,180 Q371,-104 742,180" fill="none" stroke="url(#goldFoil)" strokeWidth="0.6" opacity="0.25" />
                    </svg>
                </div>

                <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", zIndex: 2, pointerEvents: "none" }}>
                    <svg viewBox="0 0 742 300" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "auto", display: "block" }}>
                    <defs>
                        <linearGradient id="goldFoilBottom" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#FFF3B0" />
                            <stop offset="12%" stopColor="#F5D77A" />
                            <stop offset="35%" stopColor="#C9A646" />
                            <stop offset="48%" stopColor="#B8962E" />
                            <stop offset="52%" stopColor="#FFF3B0" />
                            <stop offset="68%" stopColor="#F5D77A" />
                            <stop offset="85%" stopColor="#C9A646" />
                            <stop offset="100%" stopColor="#B8962E" />
                        </linearGradient>
                    </defs>
                    <path d="M0,300 L742,300 L742,140 Q371,416 0,140 Z" fill="#0A1F3B" />
                    <path d="M0,140 Q371,416 742,140" fill="none" stroke="url(#goldFoilBottom)" strokeWidth="2" opacity="0.9" style={{ filter: 'drop-shadow(-1px -1px 1px rgba(255,255,255,0.7)) drop-shadow(1px 1px 2px rgba(0,0,0,0.3))' }} />
                    <path d="M0,130 Q371,410 742,130" fill="none" stroke="url(#goldFoilBottom)" strokeWidth="1.2" opacity="0.5" />
                    <path d="M0,120 Q371,404 742,120" fill="none" stroke="url(#goldFoilBottom)" strokeWidth="0.6" opacity="0.25" />
                    </svg>
                </div>

                <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', paddingTop: 80, paddingBottom: 60, paddingLeft: 60, paddingRight: 60, filter: 'url(#inkBleed)' }}>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: 300 }}>
                        <div style={{ flex: 1, height: 1, background: '#7A6C4F' }} />
                        <span style={{ fontFamily: N, fontSize: 14, fontWeight: 500, letterSpacing: '0.3em', color: '#5C6B7A', display: 'inline-block' }}>CERTIFICATE</span>
                        <div style={{ flex: 1, height: 1, background: '#7A6C4F' }} />
                    </div>

                    <h1 style={{ fontFamily: S, fontSize: 52, fontWeight: 700, fontStyle: 'italic', color: '#0B2240', marginTop: 6, lineHeight: 1.15, letterSpacing: '0.01em', textRendering: 'geometricPrecision' }}>of Achievement</h1>

                    <p style={{ fontFamily: S, fontSize: 20, fontStyle: 'italic', color: '#3A4556', marginTop: 46, letterSpacing: '0.01em', opacity: 0.8 }}>This certificate is proudly presented to</p>

                    <h2 style={{ fontFamily: S, fontSize: 43, fontWeight: 600, color: '#0B2240', marginTop: 64, letterSpacing: '0.01em', textRendering: 'geometricPrecision' }}>{d.name}</h2>

                    <p style={{ fontFamily: S, fontSize: 20, fontStyle: 'italic', color: '#3A4556', marginTop: 58, letterSpacing: '0.01em', opacity: 0.8 }}>for successfully completing</p>

                    <p style={{ fontFamily: S, fontSize: 31, fontWeight: 700, color: '#0B2240', marginTop: 20, letterSpacing: '0.01em', textRendering: 'geometricPrecision' }}>{d.course}</p>

                    <div style={{ marginTop: 'auto', width: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, paddingTop: 22, paddingBottom: 22 }}>
                        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: '#D6D0C4' }} />
                        <div style={{ position: 'relative', zIndex: 1, padding: '2px 14px', flex: 1, textAlign: 'right' }}>
                            <p style={{ margin: 0, fontFamily: S, fontSize: 22, fontStyle: 'italic', fontWeight: 500, color: '#1A202C' }}>{d.date}</p>
                        </div>
                        <div style={{ position: 'relative', zIndex: 1, padding: '0 8px' }}>
                            <div style={{ width: 70, height: 70, borderRadius: '50%', background: 'linear-gradient(135deg, #FFEC99 0%, #D4AF37 25%, #8C6A08 50%, #D4AF37 75%, #FFF9D1 100%)', boxShadow: '-1px -1px 2px rgba(255,255,255,0.8), 2px 2px 6px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ width: 'calc(100% - 6px)', height: 'calc(100% - 6px)', borderRadius: '50%', background: 'linear-gradient(to bottom, #FFFDF2 0%, #D4AF37 40%, #7A5500 50%, #F5D77A 53%, #FFF3B0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #5C4100' }}>
                                    <div style={{ width: 'calc(100% - 8px)', height: 'calc(100% - 8px)', borderRadius: '50%', border: '2px solid #FFFDF2', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 60%)' }}>
                                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0B2240" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 1px 1px rgba(255,255,255,0.6))' }}><polyline points="20 6 9 17 4 12" /></svg>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div style={{ position: 'relative', zIndex: 1, padding: '2px 14px', flex: 1, textAlign: 'left' }}>
                            <p style={{ margin: 0, fontFamily: N, fontSize: 11, color: '#7A8794', lineHeight: 1.7 }}>Issue: <span style={{ color: '#3E4C5E', fontWeight: 500 }}>{d.certificateId}</span></p>
                            <p style={{ margin: 0, fontFamily: N, fontSize: 11, color: '#7A8794', lineHeight: 1.7 }}>Gas: <span style={{ color: '#3E4C5E', fontWeight: 500 }}>1.767849579 gwei</span></p>
                        </div>
                    </div>

                    <div style={{ width: '100%', position: 'relative', marginBottom: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 16 }}>
                            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #FFEC99 0%, #D4AF37 25%, #8C6A08 50%, #D4AF37 75%, #FFF9D1 100%)', boxShadow: '-1px -1px 2px rgba(255,255,255,0.8), 2px 2px 4px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'translateY(2px)' }}>
                                <div style={{ width: 'calc(100% - 4px)', height: 'calc(100% - 4px)', borderRadius: '50%', background: 'linear-gradient(to bottom, #FFFDF2 0%, #D4AF37 40%, #7A5500 50%, #F5D77A 53%, #FFF3B0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #5C4100' }}>
                                    <div style={{ width: 'calc(100% - 6px)', height: 'calc(100% - 6px)', borderRadius: '50%', border: '1.5px solid #FFFDF2', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 60%)' }}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B2240" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 1px 1px rgba(255,255,255,0.6))' }}><polyline points="20 6 9 17 4 12" /></svg>
                                    </div>
                                </div>
                            </div>
                            <span className="blockchain-verified" style={{ fontFamily: N, fontSize: 16, fontWeight: 700, letterSpacing: '0.12em', color: '#0A1F3B', display: 'inline-block' }}>BLOCKCHAIN VERIFIED</span>
                        </div>
                        <div style={{ width: '88%', height: 1, opacity: 0.6, background: 'linear-gradient(to right, transparent, #CFC6B2 15%, #CFC6B2 85%, transparent)', margin: '0 auto 14px' }} />
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', minHeight: 80 }}>
                            <div style={{ flex: 1, paddingTop: 4, paddingLeft: 40 }}>
                                <div style={{ height: 46, marginBottom: 4, width: 140, borderBottom: '1px solid #AFA79A', display: 'flex', alignItems: 'flex-end' }}>
                                    {d.signature && <img src={d.signature} alt="Sig" style={{ height: 52, width: 140, objectFit: 'contain', objectPosition: 'left bottom', filter: 'contrast(1.2) brightness(0.85)', mixBlendMode: 'multiply', marginBottom: -1 }} />}
                                </div>
                                <p style={{ fontFamily: N, fontSize: 11, color: '#5A6573' }}>Digitally signed by <span style={{ fontWeight: 600, color: '#1A202C' }}>{d.issuer}</span></p>
                            </div>
                            <div style={{ flex: 1, paddingLeft: 16, paddingTop: 4 }}>
                                <p style={{ fontFamily: N, fontSize: 12, color: '#3A4556', marginBottom: 6 }}>Network: <span style={{ fontWeight: 700, color: '#1A202C' }}>{d.network}</span></p>
                                <p style={{ fontFamily: N, fontSize: 12, color: '#3A4556' }}>Gas: <span style={{ color: '#1A202C' }}>1.767849579 gwei</span></p>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginTop: 0, marginRight: 0 }}>
                                <div style={{ background: '#F5EFE6', border: '1px solid #D6D0C4', boxShadow: '0 4px 10px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ padding: 4 }}>
                                        {d.qrCode ? <img src={d.qrCode} alt="QR" style={{ width: 120, height: 120, objectFit: 'contain', display: 'block', mixBlendMode: 'multiply', opacity: 0.85 }} /> : <div style={{ width: 120, height: 120, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#94A3B8' }}>QR CODE</div>}
                                    </div>
                                    <div style={{ background: '#0A1A30', padding: '7px 6px', textAlign: 'center' }}>
                                        <p style={{ fontFamily: N, fontSize: 9, color: '#fff', lineHeight: 1.3 }}>Scan to verify<br />on blockchain</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
);

CertificateTemplate.displayName = "CertificateTemplate";
export default CertificateTemplate;
