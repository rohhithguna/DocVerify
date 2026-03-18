import { forwardRef } from "react";

interface CertificateTemplateProps {
    recipientName: string;
    certificateTitle: string;
    eventName: string;
    issueDate: string;
    issuerName: string;
    certificateId: string;
}

const CertificateTemplate = forwardRef<HTMLDivElement, CertificateTemplateProps>(
    ({ recipientName, certificateTitle, eventName, issueDate, issuerName, certificateId }, ref) => {
        return (
            <div
                ref={ref}
                style={{
                    position: "relative",
                    width: "800px",
                    height: "600px",
                    backgroundColor: "#ffffff",
                    fontFamily: "Georgia, serif",
                    overflow: "hidden",
                }}
            >
                {/* Outer Border */}
                <div
                    style={{
                        position: "absolute",
                        top: "16px",
                        left: "16px",
                        right: "16px",
                        bottom: "16px",
                        border: "4px double #d97706",
                    }}
                />

                {/* Inner Border */}
                <div
                    style={{
                        position: "absolute",
                        top: "28px",
                        left: "28px",
                        right: "28px",
                        bottom: "28px",
                        border: "1px solid #fbbf24",
                    }}
                />

                {/* Corner Decorations */}
                <div style={{ position: "absolute", top: "24px", left: "24px", width: "32px", height: "32px", borderTop: "2px solid #d97706", borderLeft: "2px solid #d97706" }} />
                <div style={{ position: "absolute", top: "24px", right: "24px", width: "32px", height: "32px", borderTop: "2px solid #d97706", borderRight: "2px solid #d97706" }} />
                <div style={{ position: "absolute", bottom: "24px", left: "24px", width: "32px", height: "32px", borderBottom: "2px solid #d97706", borderLeft: "2px solid #d97706" }} />
                <div style={{ position: "absolute", bottom: "24px", right: "24px", width: "32px", height: "32px", borderBottom: "2px solid #d97706", borderRight: "2px solid #d97706" }} />

                {/* Header Decoration - centered lines with diamond */}
                <div style={{ position: "absolute", top: "70px", left: "50%", transform: "translateX(-50%)", width: "200px", height: "20px" }}>
                    <div style={{ position: "absolute", top: "9px", left: "0px", width: "70px", height: "2px", backgroundColor: "#d97706" }} />
                    <div style={{ position: "absolute", top: "4px", left: "85px", width: "12px", height: "12px", border: "2px solid #d97706", transform: "rotate(45deg)" }} />
                    <div style={{ position: "absolute", top: "9px", right: "0px", width: "70px", height: "2px", backgroundColor: "#d97706" }} />
                </div>

                {/* CERTIFICATE text */}
                <div
                    style={{
                        position: "absolute",
                        top: "110px",
                        left: "0",
                        right: "0",
                        textAlign: "center",
                        fontSize: "14px",
                        letterSpacing: "4px",
                        textTransform: "uppercase",
                        color: "#b45309",
                    }}
                >
                    CERTIFICATE
                </div>

                {/* of Achievement */}
                <div
                    style={{
                        position: "absolute",
                        top: "135px",
                        left: "0",
                        right: "0",
                        textAlign: "center",
                        fontSize: "32px",
                        color: "#1f2937",
                        fontWeight: "normal",
                    }}
                >
                    {certificateTitle || "of Achievement"}
                </div>

                {/* This certificate is proudly presented to */}
                <div
                    style={{
                        position: "absolute",
                        top: "195px",
                        left: "0",
                        right: "0",
                        textAlign: "center",
                        fontSize: "14px",
                        color: "#6b7280",
                    }}
                >
                    This certificate is proudly presented to
                </div>

                {/* Recipient Name */}
                <div
                    style={{
                        position: "absolute",
                        top: "225px",
                        left: "0",
                        right: "0",
                        textAlign: "center",
                        fontSize: "42px",
                        fontFamily: "'Brush Script MT', 'Segoe Script', cursive",
                        color: "#b45309",
                        fontWeight: "normal",
                    }}
                >
                    {recipientName || "Recipient Name"}
                </div>

                {/* Decorative line under name */}
                <div
                    style={{
                        position: "absolute",
                        top: "290px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: "200px",
                        height: "2px",
                        background: "linear-gradient(to right, transparent, #d97706, transparent)",
                    }}
                />

                {/* for successfully completing */}
                <div
                    style={{
                        position: "absolute",
                        top: "315px",
                        left: "0",
                        right: "0",
                        textAlign: "center",
                        fontSize: "14px",
                        color: "#6b7280",
                    }}
                >
                    for successfully completing
                </div>

                {/* Event Name */}
                <div
                    style={{
                        position: "absolute",
                        top: "345px",
                        left: "0",
                        right: "0",
                        textAlign: "center",
                        fontSize: "20px",
                        color: "#1f2937",
                        fontWeight: "500",
                    }}
                >
                    {eventName || "Event / Course Name"}
                </div>

                {/* Date section */}
                <div style={{ position: "absolute", top: "440px", left: "100px", textAlign: "center" }}>
                    <div style={{ width: "120px", height: "1px", backgroundColor: "#9ca3af", marginBottom: "8px" }} />
                    <div style={{ fontSize: "10px", color: "#6b7280", marginBottom: "4px" }}>Date</div>
                    <div style={{ fontSize: "14px", color: "#1f2937" }}>{issueDate || "DD/MM/YYYY"}</div>
                </div>

                {/* VERIFIED seal in center */}
                <div
                    style={{
                        position: "absolute",
                        top: "420px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: "70px",
                        height: "70px",
                        borderRadius: "50%",
                        border: "2px solid #d97706",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <span style={{ fontSize: "10px", fontWeight: "bold", color: "#d97706" }}>VERIFIED</span>
                </div>

                {/* Issuer section */}
                <div style={{ position: "absolute", top: "440px", right: "100px", textAlign: "center" }}>
                    <div style={{ width: "120px", height: "1px", backgroundColor: "#9ca3af", marginBottom: "8px" }} />
                    <div style={{ fontSize: "10px", color: "#6b7280", marginBottom: "4px" }}>Issued By</div>
                    <div style={{ fontSize: "14px", color: "#1f2937" }}>{issuerName || "Organization"}</div>
                </div>

                {/* Certificate ID at bottom */}
                <div
                    style={{
                        position: "absolute",
                        bottom: "45px",
                        left: "0",
                        right: "0",
                        textAlign: "center",
                        fontSize: "11px",
                        color: "#9ca3af",
                    }}
                >
                    Certificate ID: {certificateId || "CERT-XXXX-XXXX"}
                </div>
            </div>
        );
    }
);

CertificateTemplate.displayName = "CertificateTemplate";

export default CertificateTemplate;
