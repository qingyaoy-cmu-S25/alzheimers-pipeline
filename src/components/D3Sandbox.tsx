import React, { useEffect, useRef } from 'react';
import * as d3Module from 'd3';

interface D3SandboxProps {
    code: string;
    data?: any;
    height?: number | string;
    useIframe?: boolean;
}

export function D3Sandbox({ code, data = [], height = 360, useIframe = false }: D3SandboxProps) {
    const ref = useRef<HTMLDivElement | HTMLIFrameElement | null>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        function runInline() {
            const root = el as HTMLDivElement;
            const d3lib = d3Module;
            if (!root.id) root.id = `sandbox`;
            root.innerHTML = "";
            (window as any).d3 = d3lib;

            try {
                const userFn = new Function(`
                    return (function(d3, data, root){
                        ${code}
                    });
                `)();
                console.log('userFn', userFn);
                
                userFn(d3lib, data, root);
            } catch (err: any) {
                root.innerHTML = `<pre style="color:red">D3 execution error:\n${err?.stack || err}</pre>`;
            }
        }

//         function runIframe() {
//             const iframe = el as HTMLIFrameElement;
//             const encodedData = encodeURIComponent(JSON.stringify(data));
//             const encodedCode = encodeURIComponent(code);

//             const html = `<!doctype html>
// <html>
// <head>
// <meta charset="utf-8" />
// <style>html, body, #root {height:100%;margin:0;padding:0;}</style>
// </head>
// <body>
// <div id="root"></div>
// <script src="https://unpkg.com/d3@7"></script>
// <script>
// console.log = (...args) => parent.console.log("iframe:", ...args);
// try {
//     const data = JSON.parse(decodeURIComponent("${encodedData}"));
//     const userCode = decodeURIComponent("${encodedCode}");
//     const root = document.getElementById("root");
//     d3.select(root).selectAll("*").remove();
//     new Function("d3", "data", "root", userCode)(d3, data, root);
// } catch(e) {
//     const pre = document.createElement("pre");
//     pre.style.color = "red";
//     pre.textContent = "D3 execution error:\\n" + (e?.stack || e);
//     document.getElementById("root").appendChild(pre);
// }
// </script>
// </body>
// </html>`;

//             iframe.srcdoc = html;
//         }

        // 延迟执行确保 DOM 可见（Modal 内尤为重要）
        const timer = setTimeout(() => {
            // if (useIframe) runIframe();
            runInline();
        }, 50);

        return () => clearTimeout(timer);
    }, [code, data, useIframe]);

    return useIframe ? (
        <iframe
            ref={ref as React.RefObject<HTMLIFrameElement>}
            title="d3-sandbox"
            style={{
                width: "100%",
                height: typeof height === "number" ? `${height}px` : height,
                border: "0",
                borderRadius: 6,
            }}
            sandbox="allow-scripts allow-same-origin"
        />
    ) : (
        <div
            ref={ref as React.RefObject<HTMLDivElement>}
            style={{
                width: "100%",
                height: typeof height === "number" ? `${height}px` : height,
                border: "0",
                overflow: "auto",
            }}
        />
    );
}

export default D3Sandbox;
