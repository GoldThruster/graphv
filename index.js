import * as u from './utils.js';


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
    s: 83,
    space: 32
}

const page = {
    graph: $('#graph'),
    colorPicker: $('#colorpicker'),
}

const features = {
    deleteSelection: function () {
        network.deleteSelected();
    },
    rename: function () {
        if(!u.isEmpty(network.getSelectedNodes()))
            rewrite(false, data.nodes, u.last(network.getSelectedNodes()));
        else if (!u.isEmpty(network.getSelectedEdges()))
            rewrite(true, data.edges, u.last(network.getSelectedEdges()));
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
    },
    changeColor: function (event) {
        function updateColor(x) {return {id: x, color: color}};

        const color = event.target.value;
        const coloredN = network.getSelectedNodes().map(updateColor);
        const coloredE = network.getSelectedEdges().map(updateColor);
        data.nodes.update(coloredN);
        data.edges.update(coloredE);
    },
    togglePhysics: function (doesPhysicsApply) {
        function updatePhysics(x) {
            return {id: x, physics: doesPhysicsApply};
        };
        updateNodes((x) => stripPosition(updatePhysics(x)));
        updateEdges(updatePhysics);
        // const upN = network.getSelectedNodes().map();
        // const upE = network.getSelectedEdges().map(updatePhysics);
        // data.nodes.update(upN);
        // data.edges.update(upE);
    },
    toggleArrow: function() {
        var selected = data.edges.get(network.getSelectedEdges());

        function internal(prev) {
            console.log("arrows", prev.arrows);

            var newArrows;
            
            switch (prev.arrows) {
                case undefined:
                case '':
                    newArrows = 'to';
                    break;
                case 'to':
                    newArrows = 'from';
                    break;
                default:
                    newArrows = '';
                    break;
            }

            return {id: prev.id, arrows: newArrows};
        }
        updateEdges(internal, selected);
    }
}

function stripPosition(from) {
    return {...from, x: undefined, y: undefined};
}

function updateContainer(container, f, elems) {
    const newN = elems.map(f);
    container.update(newN);
}

function updateNodes(f, nodes) {
    var n = nodes || network.getSelectedNodes();
    updateContainer(data.nodes, f, n);
}

function updateEdges(f, edges) {
    updateContainer(data.edges, f, (edges || network.getSelectedEdges()));
}

function updateGraph(f, nodes, edges) {
    updateNodes(f, nodes);
    updateEdges(f, edges);
}


const handlers = {
    keydown: [
        u.when(u.isOneOf([keys.delete, keys.backspace]), features.deleteSelection),
        u.when(u.is(keys.enter),                         features.rename),
        u.when((k) => k == keys.s && shifted,            features.export),
        u.when((k) => k == keys.d && shifted,            features.duplicate),
        u.when(u.is(keys.space),                         features.toggleArrow)
    ],
    beforeunload: [
        features.promptExitComfirmation,
    ],
    drop: [
        u.check(isJson, function (event) {
            const file = event.dataTransfer.files[0];
            title = file.name.split('.')[0];
            document.title = "Graph editor: " + title;
            file.text().then(features.import, (reason) => alert("File not read: " + reason));
            event.preventDefault();
        }),
        u.check(isHtml, function(event) {
            const file = event.dataTransfer.files[0];
            const nodeId = network.getNodeAt({x: event.pageX, y: event.pageY});
            if(nodeId)
            {
                file.text().then((text) => associateDoc(nodeId, text), (reason) => alert("File not read: " + reason));
                event.preventDefault();
            }
        })
    ],
    color: {
        begin: [
            u.ignore(() => features.togglePhysics(false))
        ],
        update: [
            features.changeColor
        ],
        end: [
            u.ignore(() => features.togglePhysics(true))
        ]
    }
}

function wireEvents() {
    page.graph.on('keydown', u.mediate('which', u.dispatch(handlers.keydown)));
    page.graph.on('drop', u.mediate('originalEvent', u.dispatch(handlers.drop)));
    page.colorPicker.on('click', u.dispatch(handlers.color.begin));
    page.colorPicker.on('input', u.dispatch(handlers.color.update));
    page.colorPicker.on('change', u.dispatch(handlers.color.end));
    window.addEventListener('beforeunload',   u.dispatch(handlers.beforeunload));
}

function isJson(event) {
    const file = event.dataTransfer?.files?.item(0);
    return file && file.type === 'application/json';
}

function isHtml(event) {
    const file = event.dataTransfer?.files?.item(0);
    return file && file.type === 'text/html';
}

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

function duplicate(){
    function substituteIdN(acc, x) {
        const newId = u.uid();
        acc.nodes.push({...x, id: newId});
        acc.map[x.id] = newId;

        return acc;
    }

    function duplicateDocs(map) {
        const newDocs = Object.entries(map).map(([old, subst]) => {return {...docs.get(old), id: subst}});
        docs.add(newDocs);
    }

    function substituteIdE(map, x) {
        return {...x, id: u.uid(), from: map[x.from], to: map[x.to]};
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

    if(u.isEmpty(selIds))
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
    let anyN = !u.isEmpty(event.nodes);
    let anyE = !u.isEmpty(event.edges);
    let singleE = u.isSingleton(event.edges);

    if( !anyN && !anyE ) //New node
    {
        let label = prompt("Label");
        if(label)
        {
            data.nodes.add({id: network.length, label: label, x: event.pointer.canvas.x, y: event.pointer.canvas.y, ciao: "ciao", mass: scale(1, label.length)});
        }
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
var title = "untitled";


function handleSelectNode(nodes)
{
    const id = u.last(nodes);
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
wireEvents();