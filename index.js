var renaming = false;


var shifted = false;
var alted = false;
var controled = false;

const preventSelection = {interaction: {selectable: false}};


const shiftKey = 16;
const altKey = 18;
const cntrlKey = 17;



const keys = {
    // modifiers
    shift: 16,
    ctrl: 17,
    alt: 18,
    // commands
    backspace: 8,
    enter: 13,
    delete: 46,
    // letters
    d: 68,
    s: 83
}

const page = {
    graph: $('#graph')
}

const features = {
    deleteSelection: function () {
        network.deleteSelected();
    },
    rename: function () {
        if(!isEmpty(network.getSelectedNodes()))
            rewrite(false, data.nodes, last(network.getSelectedNodes()));
        else if (!isEmpty(network.getSelectedEdges()))
            rewrite(true, data.edges, last(network.getSelectedEdges()));
    },
    export: function () {
        network.stopSimulation();
        network.storePositions();
        const d = {nodes: data.nodes.get(), edges: data.edges.get(), docs: docs.get()};
        const toExport = JSON.stringify(d);
        download(toExport, title, "json");
    },
    import: function (file) {
        const toImport = JSON.parse(file);
        data = {
            nodes: new vis.DataSet(toImport.nodes),
            edges: new vis.DataSet(toImport.edges)
        };
        docs = new vis.DataSet(toImport.docs);
        
        network.setData(data);
    },
    duplicate: duplicate,
    promptExitComfirmation: function (event) {
        event.preventDefault(); 
        event.returnValue = "Are you sure?";
    }
}

const handlers = {
    keydown: [
        when(isOneOf([keys.delete, keys.backspace]), features.deleteSelection),
        when(is(keys.enter),                         features.rename),
        when((k) => k == keys.s && shifted,          features.export),
        when((k) => k == keys.d && shifted,          features.duplicate)
    ],
    beforeunload: [
        features.promptExitComfirmation,
    ],
    drop: [
        check(isJson, function (event) {
            const file = event.dataTransfer.files[0];
            title = file.name.split('.')[0];
            document.title = "Graph editor: " + title;
            file.text().then(features.import, (reason) => alert("File not read: " + reason));
            event.preventDefault();
        }),
        check(isHtml, function(event) {
            const file = event.dataTransfer.files[0];
            const nodeId = network.getNodeAt({x: event.pageX, y: event.pageY});
            if(nodeId)
            {
                file.text().then((text) => associateDoc(nodeId, text), (reason) => alert("File not read: " + reason));
                event.preventDefault();
            }
        })
    ]
}

function wireEvents() {
    page.graph.on('keydown', mediate('which', dispatch(handlers.keydown)));
    page.graph.on('drop', mediate('originalEvent', dispatch(handlers.drop)));
    window.addEventListener('beforeunload',   dispatch(handlers.beforeunload));
}

function isJson(event) {
    const file = event.dataTransfer?.files?.item(0);
    return file && file.type === 'application/json';
}

function isHtml(event) {
    const file = event.dataTransfer?.files?.item(0);
    return file && file.type === 'text/html';
}



function ignore(f) {
    return (_) => f();
}

function isOneOf(arr) {
    return (elem) => Array.prototype.includes.call(arr, elem);
}

function is(a) {
    return (b) => a == b;
}


function last(arr){
    return arr.slice(-1)[0];
}



function check(p, f) {
    function internal(x) {
        const hasMatched = p.call(null, x);
        if(hasMatched) {
            f(x);
        }
        return hasMatched;
    }

    return internal;
}

function when(p, f) {
    return check(p, ignore(f));
}

function dispatch(fs) {
    function internal(x) {
        for (const f of fs) {
            if(f(x)) return;
        }
    }

    return internal;
}

function mediate(key, f) {
    function internal(x) {
        f(x[key]);
    }

    return internal;
} 



wireEvents();

page.graph.on('keydown', function(e){
    switch (e.which) {
        case shiftKey:
            network.setOptions({...options, ...preventSelection});
            shifted = true;
            break;
        case altKey:
            alted = true;
            break;
        case cntrlKey:
            controled = true;
            break;
    }

    return true;
});

page.graph.on('keyup', function(e){
    switch (e.which) {
        case shiftKey:
            network.setOptions(options);
            shifted = false;
            break;
        case altKey:
            alted = false;
            break;
        case cntrlKey:
            controled = false;
            break;
    }

    return true;
});


function uid(){
    //return Date.now().toString(36) + Math.random().toString(36).slice(0, 10);
    return self.crypto.randomUUID();
}

function duplicate(){
    function substituteIdN(acc, x) {
        const newId = uid();
        acc.nodes.push({...x, id: newId});
        acc.map[x.id] = newId;

        return acc;
    }

    function duplicateDocs(map) {
        const newDocs = Object.entries(map).map(([old, subst]) => {return {...docs.get(old), id: subst}});
        docs.add(newDocs);
    }

    function substituteIdE(map, x) {
        return {...x, id: uid(), from: map[x.from], to: map[x.to]};
    }

    function stripId(x) {
        var y = {...x}
        delete y.id;
        return y;
    }

    function hasNodesSelected(x) {
        if(selIds.includes(x.from) && selIds.includes(x.to)) {
            return true;
        }
        
        return false;
    }

    const selIds = network.getSelectedNodes();
    const selE = data.edges.get(network.getSelectedEdges());

    if(isEmpty(selIds))
    {
        data.edges.add(selE.map(stripId));
    }
    else
    {
        const substituted = data.nodes.get(selIds).reduce(substituteIdN, {nodes: [], map: {}});
        const selEE = selE.filter(hasNodesSelected).map((x) => substituteIdE(substituted.map, x));
        data.nodes.add(substituted.nodes);
        data.edges.add(selEE);
        duplicateDocs(substituted.map);
    }
    
}



function handleConnectionDrag(event) {
    event.event.preventDefault();
    network.addEdgeMode();
}

function isEmpty (x) {
    return typeof x === 'undefined' || x.length === 0
}

function isSingleton (x) {
    return typeof x !== 'undefined' && x.length === 1
}

function rewrite(isEdge, set, id) {
    let elem = set.get(id);
    let newLabel = prompt("New label", elem.label);
    
    const preLabel = newLabel ?? elem.label
    const n = {...elem, label: preLabel};
    if(isEdge){
        const offset = preLabel.length;
        console.log(offset);
        if(offset > 10)
        {
            n.length = 75 + offset*1.8;
        }
        set.remove(n.id);
    }
    else {
        n.mass = scale(1, preLabel.length);
    }
    set.update(n);
}

function handleDoubleClick(event) {
    let anyN = !isEmpty(event.nodes);
    let anyE = !isEmpty(event.edges);
    let singleE = isSingleton(event.edges);

    if( !anyN && !anyE ) //New node
    {
        let label = prompt("Label");
        data.nodes.add({id: network.length, label: label, x: event.pointer.canvas.x, y: event.pointer.canvas.y, mass: scale(1, label.length)});
    }
    else if (singleE && !anyN) //Edit edge
    {
        network.editEdgeMode();
    }
}

function scale(min, l) {
    return Math.max(min, Math.log2(l)) * 1.2;
}

function handleClick(event) {
    if(shifted) {
        const newN = network.getNodeAt({x: event.pointer.DOM.x, y: event.pointer.DOM.y});
        const newEdges = event.nodes.map(function (x) {return {from: x, to: newN}});

        data.edges.update(newEdges);
    }
    else if (alted) {
        network.moveTo({
            position: {x: event.pointer.canvas.x, y: event.pointer.canvas.y},
            scale: 1.5,
            animation: {
                duration: 100,
                easingFunction: 'easeInQuad'
            }
        });
    }
}

var cnt = $("#cnt");
var toolbar = document.getElementById('toolbar');
var nodeColorPicker = document.getElementById('nodeColor');
var title = "untitled";

nodeColorPicker.addEventListener('input', (event) => {
    function updateColor(x) {return {...x, color: color}}
    const color = event.target.value;
    const coloredN = data.nodes.get(network.getSelectedNodes()).map(updateColor);
    const coloredE = data.edges.get(network.getSelectedEdges()).map(updateColor);
    data.nodes.update(coloredN);
    data.edges.update(coloredE);
});

function handleSelectNode(nodes)
{
    const id = last(nodes);
    const newD = docs.get(id);
    
    const isNew = !shown.includes(id);

    if(isNew && newD && newD.content)
    {
        shown.push(id);
        if(shown.length > 4)
        {
            shown.shift();
            cnt.children()[0].remove();
        }
        
        cnt.append("<div class=\"cnt-item\">" + newD.content + "</div>");
    }
}

function handleDeselectNode(event)
{
    const ids = event.nodes.slice(0, 4);
    const children = cnt.children();
    shown.forEach(function (x, i) {
        if(!ids.includes(x)) {
            children[i]?.remove();
        }
    });

    shown = ids;
}


function download (cnt, fileName, fileType)  {
    const anchor = document.getElementById('local_filesaver') || document.createElement('a');
    var mimeType;
    switch (fileType)  {
        case 'txt': 
        case 'htm': 
        case 'html': 
        case 'pdf': 
        case 'htm': 
        case 'js':
        case 'json': mimeType="application/unknown";
            break;
        default: mimeType="";
    }

    const name = fileName + "." + fileType
    const data = new File([cnt], name, {type: mimeType});
    const url = URL.createObjectURL(data);

    if (!anchor.id)  {
        anchor.id = 'local_filesaver';
        anchor.download = name;
        anchor.target = '_blank';
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
    }

    anchor.setAttribute('href', url);
    anchor.click();
    URL.revokeObjectURL(url);  
}

// create a network
var container = document.getElementById('graph');

container.addEventListener("dragenter", (event) => {
    const isText = event.dataTransfer.types.includes("Files");
    if(isText)
    {
        event.preventDefault();
    }
});

container.addEventListener("dragover", (event) => {
    const isText = event.dataTransfer.types.includes("Files");
    if(isText)
    {
        event.preventDefault();
    }
});

function associateDoc(id, text) {
    docs.update({id: id, content: text});
    
    const sel = network.getSelectedNodes();
    sel.push(id);
    network.selectNodes(sel);
    handleSelectNode(sel);
}


var docs = new vis.DataSet([]);

var shown = [];



// provide the data in the vis format
var data = {
    nodes: new vis.DataSet([]),
    edges: new vis.DataSet([])
};
var options = {
    manipulation: {
        enabled: false
    },
    edges: {
        arrows: 'to',
        widthConstraint: 75
    },
    nodes: {
        font: {
            size: 16,
            strokeWidth: 0.3,
            strokeColor: '#343434'
        },
        widthConstraint: {
            minimum: 5,
            maximum: 120
        },
        shape: 'box'
    },
    interaction: {
        selectable: true,
        multiselect: true
    },
    layout: {
        randomSeed: 100
    }
};

// initialize your network!
var network = new vis.Network(container, data, options);

network.on("doubleClick", handleDoubleClick);
network.on("click", handleClick);
network.on("selectNode", (e) => handleSelectNode(e.nodes));
network.on("deselectNode", handleDeselectNode);