var renaming = false;


var shifted = false;
var alted = false;
var controled = false;

const preventSelection = {interaction: {selectable: false}};

const deleteKey = 46;
const shiftKey = 16;
const enterKey = 13;
const backspaceKey = 8;
const altKey = 18;
const cntrlKey = 17;
const sKey = 83;
const dKey = 68;

function last(arr){
    return arr.slice(-1)[0];
}

$("#graph").on('keydown', function(e){
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

        case backspaceKey:
        case deleteKey:
            network.deleteSelected();
            break;
        case enterKey:
            if(!isEmpty(network.getSelectedNodes())) {
                rewrite(false, data.nodes, last(network.getSelectedNodes()));
            }
            else if (!isEmpty(network.getSelectedEdges())) {
                rewrite(true, data.edges, last(network.getSelectedEdges()));
            }
            break;
        case sKey:
            if(shifted) {
                exportNetwork();
            }
            break;
        case dKey:
            if(shifted) {
                duplicate();
            }
            break;
    }

    return true;
});
$("#graph").on('keyup', function(e){
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

function rewrite(doForce, set, id) {
    let elem = set.get(id);
    let newLabel = prompt("New label", elem.label);
    
    const n = {...elem, label: newLabel ?? elem.label};
    if(doForce){
        set.remove(n.id);
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
        data.nodes.add({id: network.length, label: label, x: event.pointer.canvas.x, y: event.pointer.canvas.y})
    }
    else if (singleE && !anyN) //Edit edge
    {
        network.editEdgeMode();
    }
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
})

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


function exportNetwork() {
    network.storePositions();
    const d = {nodes: data.nodes.get(), edges: data.edges.get(), docs: docs.get()};
    const toExport = JSON.stringify(d);
    download(toExport, title, "json");
}

function importNetwork(file) {
    const toImport = JSON.parse(file);
    data = {
        nodes: new vis.DataSet(toImport.nodes),
        edges: new vis.DataSet(toImport.edges)
    };
    docs = new vis.DataSet(toImport.docs);
    
    network.setData(data);
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


container.addEventListener('drop', (event) => {
    const isFiles = event.dataTransfer.types.includes("Files");
    if(isFiles)
    {   
        const data = event.dataTransfer.files[0];

        if(data.type === 'application/json')
        {   
            title = data.name.split('.')[0];
            document.title = "Graph editor: " + title;
            data.text().then(importNetwork, (reason) => alert("File not read: " + reason));
            event.preventDefault();
        }
        else if (data.type === 'text/html')
        {
            const nodeId = network.getNodeAt({x: event.pageX, y: event.pageY});

            if(nodeId)
            {
                data.text().then((text) => associateDoc(nodeId, text), (reason) => alert("File not read: " + reason));
                event.preventDefault();
            }
        }
    }
});

function associateDoc(id, text) {
    docs.update({id: id, content: text});
    
    const sel = network.getSelectedNodes();
    sel.push(id);
    network.selectNodes(sel);
    handleSelectNode(sel);
}

// create an array with nodes
var nodes = new vis.DataSet([]);


var docs = new vis.DataSet([]);

var shown = [];

// create an array with edges
var edges = new vis.DataSet([]);



// provide the data in the vis format
var data = {
    nodes: nodes,
    edges: edges
};
var options = {
    manipulation: {
        enabled: false
    },
    nodes: {
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