import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
export function renderSafeMd(md) {
    const children = [];
    const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    let last = 0, m;
    while ((m = re.exec(md))) {
        if (m.index > last)
            children.push(md.slice(last, m.index));
        children.push(_jsx("a", { href: m[2], target: "_blank", rel: "noopener noreferrer", children: m[1] }, m.index));
        last = re.lastIndex;
    }
    if (last < md.length)
        children.push(md.slice(last));
    return _jsx(_Fragment, { children: children });
}
