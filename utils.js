export function uid(){
    return self.crypto.randomUUID();
}

export function isEmpty (x) {
    return typeof x === 'undefined' || x.length === 0
}

export function isSingleton (x) {
    return typeof x !== 'undefined' && x.length === 1
}

export function ignore(f) {
    return (_) => f();
}

export function isOneOf(arr) {
    return (elem) => Array.prototype.includes.call(arr, elem);
}

export function is(a) {
    return (b) => a == b;
}


export function last(arr){
    return arr.slice(-1)[0];
}

export function check(p, f) {
    function internal(x) {
        const hasMatched = p.call(null, x);
        if(hasMatched) {
            f(x);
        }
        return hasMatched;
    }

    return internal;
}

export function when(p, f) {
    return check(p, ignore(f));
}

export function dispatch(fs) {
    function internal(x) {
        for (const f of fs) {
            if(f(x)) return;
        }
    }

    return internal;
}

export function mediate(key, f) {
    function internal(x) {
        f(x[key]);
    }

    return internal;
}

export function same(x) {
    return x;
}