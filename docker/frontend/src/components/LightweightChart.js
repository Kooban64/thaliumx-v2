"use client";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LightweightChart = LightweightChart;
const react_1 = require("react");
const lightweight_charts_1 = require("lightweight-charts");
function LightweightChart({ height = 360, backgroundColor = "#0b1020", lineColor = "#2962FF", textColor = "#D1D5DB", topColor = "rgba(41, 98, 255, 0.4)", bottomColor = "rgba(41, 98, 255, 0.0)", data = [], }) {
    const containerRef = (0, react_1.useRef)(null);
    const seriesRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => {
        if (!containerRef.current)
            return;
        const chart = (0, lightweight_charts_1.createChart)(containerRef.current, {
            height,
            layout: {
                background: { type: lightweight_charts_1.ColorType.Solid, color: backgroundColor },
                textColor,
            },
            rightPriceScale: {
                borderVisible: false,
            },
            timeScale: {
                borderVisible: false,
            },
            grid: {
                vertLines: { color: "rgba(42, 46, 57, 0.2)" },
                horzLines: { color: "rgba(42, 46, 57, 0.2)" },
            },
            crosshair: {
                horzLine: { visible: false },
            },
        });
        const series = chart.addAreaSeries({
            lineColor,
            topColor,
            bottomColor,
            lineWidth: 2,
        });
        seriesRef.current = series;
        if (data.length) {
            series.setData(data);
            chart.timeScale().fitContent();
        }
        const resize = () => {
            if (!containerRef.current)
                return;
            chart.applyOptions({ width: containerRef.current.clientWidth });
        };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(containerRef.current);
        return () => {
            ro.disconnect();
            chart.remove();
        };
    }, [backgroundColor, bottomColor, data, height, lineColor, textColor, topColor]);
    (0, react_1.useEffect)(() => {
        if (seriesRef.current && data.length) {
            seriesRef.current.setData(data);
        }
    }, [data]);
    return <div ref={containerRef} style={{ width: "100%" }}/>;
}
//# sourceMappingURL=LightweightChart.js.map