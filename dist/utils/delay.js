export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
export function randomDelay(minMs, maxMs) {
    const ms = Math.random() * (maxMs - minMs) + minMs;
    return delay(ms);
}
//# sourceMappingURL=delay.js.map