

var canvas;
var gl;
debug = 10;
output = 0;

var numpts = 0;
var numBalls = 0;
var points = [];
var colors = [];
var normals = [];
var allballs = [];
var allsquares = [];
var theta = 0.0;
var cubeSize = 1; // size of boundary cube of simulation.
var velocityThreshold = 0.01;
var eye = vec3(0.0,0,1.1);
var at = vec3(0.0,0.0,0.0);
var up = vec3(0.0,1.0,0.0);
var mv = lookAt(eye,at,up);


//to keep a steady FPS and ensure that the physics work based on time, not how often it is rendered
var lastFrame = Date.now();
var currentFrame = 0;



// these set defaults
var shape = "ball";
var radius = .1;
var loc = vec4(0.0,0.0,0.0,1.0);
var velocity = vec3(0.0,0.0,0.0);
var accel = vec3(0.0,-9.8,0.0);
var weight = 1.0;
var clr = vec3(1.0,1.0,1.0);
var rpm = vec3(1,1,1);
var rspeed = 1;
var friction = 0.1;
var lightpos = vec3(1.0,1.0,-1.0);

var defcolors = [
    vec4( 0.0, 0.0, 0.0, 1.0 ),  // black
    vec4( 1.0, 0.0, 0.0, 1.0 ),  // red
    vec4( 1.0, 1.0, 0.0, 1.0 ),  // yellow
    vec4( 0.0, 1.0, 0.0, 1.0 ),  // green
    vec4( 0.0, 0.0, 1.0, 1.0 ),  // blue
    vec4( 1.0, 0.0, 1.0, 1.0 ),  // magenta
    vec4( 0.0, 1.0, 1.0, 1.0 )   // cyan
];


window.onload = function init() {
    canvas = document.getElementById( "gl-canvas" );

    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }

    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( 0.8, 0.8, 0.8, 1.0 );
    gl.clear( gl.COLOR_BUFFER_BIT );

    //
    //  Load shaders and initialize attribute buffers
    //
    colors.push(clr);
    points.push(loc);
    ball();

    var program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );

    gl.enable(gl.DEPTH_TEST);

    light = gl.getUniformLocation(program, "lightDir");
    gl.uniform3fv(light, lightpos);

    nBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, nBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(normals), gl.STATIC_DRAW);

    var vNormal = gl.getAttribLocation(program, "vNormal");
    gl.vertexAttribPointer(vNormal, 3, gl.FLOAT, false, 0,0);
    gl.enableVertexAttribArray(vNormal);

    var cBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW );

    var vColor = gl.getAttribLocation( program, "vColor");
    gl.vertexAttribPointer(vColor, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);
    
    vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);

    var vPosition = gl.getAttribLocation( program, "vPosition");
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    mvloc = gl.getUniformLocation(program, "mv");
    gl.uniformMatrix4fv(mvloc, gl.FALSE, mv);

    r = gl.getUniformLocation(program, "r");

    perspectiveMatrix = gl.getUniformLocation(program, "perspective");
    gl.uniformMatrix4fv(perspectiveMatrix, gl.false, perspective(90,1,.2,5));


   
    canvas.addEventListener("mousedown", function(event) {
       loc[0] = 2*event.clientX/canvas.width-1;
       loc[1] = -(2*event.clientY/canvas.height-1);
       if (shape === "ball") {
            ball();
            gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    	    gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);
    	    gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
    		gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);
            gl.bindBuffer(gl.ARRAY_BUFFER, nBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, flatten(normals), gl.STATIC_DRAW);
       }
    });


    render();
}


function render() {
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
    currentFrame = Date.now();
    timeElapsed = (currentFrame - lastFrame)/1000;
    lastFrame = currentFrame;
    collision(allballs, timeElapsed);
    //theta += 0.5;
    if (points.length > 0) {
        //console.log(points.length, numpts);
    	for (var i = 0; i < numBalls; i+=1) {
            var t = getT(allballs[i]);
            var rm = getR(allballs[i]);
            
            rm = mult(t, rm);
            gl.uniformMatrix4fv(r, gl.FALSE, rm);
            gl.drawArrays(gl.TRIANGLES, 3072*i, 3072);
            //gl.drawArrays(gl.TRIANGLES, 599*i, 599);
    	}
    }
    window.requestAnimationFrame(render);
    
}

function normal(v1,v2,v3) {
	// var norm = vec4(0,0,0,1.0);
	// var u = vec4(v2[0]-v1[0],v2[1]-v1[1],v2[2]-v1[2],1);
	// var v = vec4(v3[0]-v1[0],v3[1]-v1[1],v3[2]-v1[2],1);
	// norm[0] = Math.abs(u[1] * v[2] - u[2] * v[1]);
	// norm[1] = Math.abs(u[0] * v[2] - u[2] * v[0]);
	// norm[2] = Math.abs(u[0] * v[1] - u[1] - v[0]);

    var centroid = vec3((v1[0]+v2[0]+v3[0])/3.0, (v1[1]+v2[1]+v3[1])/3.0, (v1[2]+v2[2]+v3[2])/3.0);
    return subtract(centroid, vec3(0,0,0));
	
}
    


function distance(v1, v2) {
    var xt = v1[0] - v2[0];
    xt = xt * xt;
    var yt = v1[1] - v2[1];
    yt = yt*yt;
    var zt = v1[2] - v2[2];
    zt = zt*zt;
    return (Math.sqrt(xt+yt+zt));
}

function getT(obj) {
    //console.log(obj.loc);
    return translate(obj.loc[0], obj.loc[1], obj.loc[2]);
}

function getR(obj) {
    return rotate(obj.rspeed*obj.theta, obj.rpm);
}

function ball() {
	if (numBalls === 0) {
		points = [];
		colors = [];
	}
	b = {};
	b.shape = "ball";
	b.radius = 1*radius;
	b.loc = vec3(loc[0], loc[1], loc[2]);
	b.velocity = vec3(velocity[0], velocity[1], velocity[2]);
	b.accel = vec3(accel[0], accel[1], accel[2]);
	b.color = vec3(clr[0], clr[1], clr[2]);
	b.weight = 1.0*weight;
    b.rpm = vec3(rpm[0], rpm[1], rpm[2]);
    b.rspeed = 1*rspeed;
    b.friction = 1*friction;
    b.rot = vec3(0.0,0.0,0.0);
    b.theta = 0;
   makeBall(b);
   numBalls+=1;
   allballs.push(b);
}

function cube() {
    s = {};
    s.shape = "cube";
    s.side = radius;
    s.loc = loc;
    s.velocity = velocity;
    s.accel = accel;
    s.color = clr;
    s.weight = weight;
    s.rpm = rpm;
    s.rspeed = rspeed;
    makeSquare();
    numSquares += 1;
    allsquares.push(s);
}

function makeBall(b) {
    //makeSphere(10,10,b);


    var va = vec4(0.0, 0.0, -1.0,1.0/b.radius);
   
    var vb = vec4(0.0, 0.942809, 0.333333, 1.0/b.radius);
    
    var vc = vec4(-0.816497, -0.471405, 0.333333, 1.0/b.radius);
   
    var vd = vec4(0.816497, -0.471405, 0.333333,1.0/b.radius);
    
    tetrahedron(va,vb,vc,vd,4); //4^last number points.
   
}

function rotate3(angle, axis) {
    var v = normalize( axis );

    var x = v[0];
    var y = v[1];
    var z = v[2];

    var c = Math.cos( radians(angle) );
    var omc = 1.0 - c;
    var s = Math.sin( radians(angle) );

    var result = mat3(
        x*x*omc + c,   x*y*omc + z*s, x*z*omc - y*s,
         x*y*omc - z*s, y*y*omc + c,   y*z*omc + x*s,
         x*z*omc + y*s, y*z*omc - x*s, z*z*omc + c 
        
    );
    return result;
}



function triangle(a, b, c) {
     points.push(mult(cubeSize, a));
     points.push(mult(cubeSize, b));
     points.push(mult(cubeSize, c));
     numpts += 3;
     // colors.push(vec3(0.7-a[0],0.7-b[0],0.7-c[0]));
     // colors.push(vec3(0.7-a[0],0.7-b[0],0.7-c[0]));
     // colors.push(vec3(0.7-a[0],0.7-b[0],0.7-c[0]));
     colors.push(vec3(clr[0], clr[1], clr[2]));
     colors.push(vec3(clr[0], clr[1], clr[2]));
     colors.push(vec3(clr[0], clr[1], clr[2]));

     n = normal(a,b,c);

     // console.log(n);
     normals.push(vec3(n[0],n[1],n[2]));
     normals.push(vec3(n[0],n[1],n[2]));
     normals.push(vec3(n[0],n[1],n[2]));
}


function divideTriangle(a, b, c, count) {
    if ( count > 0 ) {

        var ab = mix( a, b, 0.5);
        var ac = mix( a, c, 0.5);
        var bc = mix( b, c, 0.5);

        ab = normalize(ab, true);
        ac = normalize(ac, true);
        bc = normalize(bc, true);

        divideTriangle( a, ab, ac, count - 1 );
        divideTriangle( ab, b, bc, count - 1 );
        divideTriangle( bc, c, ac, count - 1 );
        divideTriangle( ab, bc, ac, count - 1 );
    }
    else {
        triangle( a, b, c );
    }
}


function tetrahedron(a, b, c, d, n) {
    divideTriangle(a, b, c, n);
    divideTriangle(d, c, b, n);
    divideTriangle(a, d, b, n);
    divideTriangle(a, c, d, n);
}

function makeSphere(latBands, longBands, b) {
    spherepts = [];
    spherenorms = [];
    sphereclrs = [];
    for (var lat = 0; lat <= latBands; lat++) {
      var thta = lat * Math.PI / latBands;
      var sinTheta = Math.sin(thta);
      var cosTheta = Math.cos(thta);

      for (var long = 0; long <= longBands; long++) {
        var phi = long * 2 * Math.PI / longBands;
        var sinPhi = Math.sin(phi);
        var cosPhi = Math.cos(phi);

        var xzz = cosPhi * sinTheta;
        var yzz = cosTheta;
        var zzz = sinPhi * sinTheta;
        

        
        var norm = vec4(xzz,yzz,zzz,1.0);
        var pt = vec4(xzz,yzz,zzz, 1.0/b.radius);
        var clr = vec3(b.color[0], b.color[1], b.color[2]);
        spherenorms.push(norm);
        spherepts.push(pt);
        sphereclrs.push(clr);
      }
    }
    for (var lat = 0; lat < latBands; lat++) {
        for (var long = 0; long < longBands; long++) {
            var first = (lat*(longBands+1)) + long;
            var second = first + longBands + 1;
            points.push(spherepts[first]);
            points.push(spherepts[second]);
            points.push(spherepts[first+1]);
            colors.push(sphereclrs[first]);
            colors.push(sphereclrs[second]);
            colors.push(sphereclrs[first+1]);
            normals.push(spherenorms[first]);
            normals.push(spherenorms[second]);
            normals.push(spherenorms[first+1]);

            points.push(spherepts[second]);
            points.push(spherepts[second+1]);
            points.push(spherepts[first+1]);
            colors.push(sphereclrs[second]);
            colors.push(sphereclrs[second+1]);
            colors.push(sphereclrs[first+1]);
            normals.push(spherenorms[second]);
            normals.push(spherenorms[second+1]);
            normals.push(spherenorms[first+1]);
            numpts+=6;
        }
    }
    //console.log(points.length);
}

function collision (balls, timeElapsed) {
	// for every ball, calculate its next position and velocity, whether or not it has hit something.
	// the calculation is done in 3D, but the Z axis does NOT change.


    // box collision
    for (var i = 0; i < balls.length; i++) {
        if (Math.abs(balls[i].loc[0]) + balls[i].radius > cubeSize) {
            console.log("shape hit z wall; reversing velocity");
            //balls[i].velocity = vec3(-.9,-.9,-.9)*balls[i].velocity;
            balls[i].velocity[0] *= -.9;
          
            if (balls[i].loc[0] < 0) {
                balls[i].loc[0] = -cubeSize + balls[i].radius;
            }
            else {
                balls[i].loc[0] = cubeSize-balls[i].radius;
            }
        }
        else if(Math.abs(balls[i].loc[1]) + balls[i].radius > cubeSize) {
            //console.log("shape hit z wall; reversing velocity");
            balls[i].velocity[1] *= -.9;
            var temp = balls[i].loc[1];
            if (balls[i].loc[1] < 0) {
                balls[i].loc[1] = -cubeSize + balls[i].radius;
                temp = temp - (-cubeSize+balls[i].radius);
            }
            else {
                balls[i].loc[1] = cubeSize-balls[i].radius;
            }
        }
        else if (Math.abs(balls[i].loc[2]) + balls[i].radius > cubeSize) {
            //console.log("shape hit z wall; reversing velocity");
            balls[i].velocity[2] *= -.9;
            
            if (balls[i].loc[2] < 0) {
                balls[i].loc[2] = -cubeSize + balls[i].radius;
            }
            else {
                balls[i].loc[2] = cubeSize-balls[i].radius;
            }
        }
        else {
            continue;
        }
    }

    // object collision 
    for (var i = 0; i < balls.length; i++) {
        for (var j = i+1; j < balls.length; j++) {
            dist = distance(balls[i].loc, balls[j].loc);
            rads = balls[i].radius+balls[j].radius;
            //console.log(dist, rads);
            if (dist < rads) {
                console.log("collision");
                //move the location of one of the balls so that they are no longer within each other
                bounce(balls[i], balls[j], i, j);
                //balls[i].velocity = mult(vec3(-.9,-.9,-.9), balls[i].velocity);
                //balls[j].velocity = mult(vec3(-.9,-.9,-.9), balls[j].velocity);
            }
        }
    }

    //calculate new position
    for (var i = 0; i < balls.length; i++) {
            balls[i].theta += 180*timeElapsed;
            balls[i].loc[0] += balls[i].velocity[0]*timeElapsed;
            balls[i].loc[1] += balls[i].velocity[1]*timeElapsed;
            balls[i].loc[2] += balls[i].velocity[2]*timeElapsed;
            balls[i].velocity[0] += balls[i].accel[0]*timeElapsed;
            balls[i].velocity[1] += balls[i].accel[1]*timeElapsed;
            balls[i].velocity[2] += balls[i].accel[2]*timeElapsed;
        
        
        
    }
}

function bounce (o1, o2, pos1, pos2) {
    if (o1.shape === "ball" && o2.shape === "ball") {

        //momentums for each object
        var dist = distance(o1.loc, o2.loc);
        var offset = subtract(o1.loc, o2.loc);
        offset = normalize(offset);
        //console.log(offset);
        //console.log(o1.loc);
        while (dist <= o1.radius+ o2.radius) {
            //console.log("suh dude");
            o1.loc = vec3(o1.loc[0]+offset[0]*0.001, o1.loc[1]+offset[1]*0.001, o1.loc[2]+offset[2]*0.001);
            dist = distance(o1.loc, o2.loc);
            //console.log("suh dude1");
        }
        //offset is n
        var a1 = dot(o1.velocity, offset);
        var a2 = dot(o2.velocity, offset);
        var P = ((2*(a1-a2))/(o1.weight+o2.weight));
        var v1 = subtract(o1.velocity, vec3(offset[0]*P*o2.weight, offset[1]*P*o2.weight,offset[2]*P*o2.weight));
        var v2 = add(o2.velocity, vec3(offset[0]*P*o1.weight, offset[1]*P*o1.weight,offset[2]*P*o1.weight));
        

        o1.velocity = mult(vec3(.9,.9,.9), vec3(v1[0], v1[1], v1[2]));
        o2.velocity = mult(vec3(.9,.9,.9), vec3(v2[0], v2[1], v2[2]));

        //now do rotation

        //multiply the coords of both so that they have their new rots
        // var rot1 = rotate3(o1.theta, o1.rpm);
        // var rot2 = rotate3(o2.theta, o2.rpm);
        // var r1 = getR(o1);
        // var r2 = getR(o2);

        // var j = 1;
        // for (var i = 3072*pos1; i < 3072*pos1+3072; i++) {
        //     points[i] = mult(r1, points[i]);
        //     //normals[i] = mult(rot1, normals[i]);
        //     if (j%3 === 0) {
        //         var temp = normalize(normal(points[i-2], points[i-1], points[i]));
        //         normals[i-2] = temp;
        //         normals[i-1] = temp;
        //         normals[i] = temp;
        //         j = 0;
        //     }
        //     j++;
        // }
        // var j = 1;
        // for (var i = 3072*pos2; i < 3072*pos2+3072; i++) {
        //     //console.log(points[i]);
        //     points[i] = mult(r2, points[i]);
        //     //normals[i] = mult(rot2, normals[i]);
        //     if (j%3 === 0) {
        //         var temp = normalize(normal(points[i-2], points[i-1], points[i]));
        //         normals[i-2] = temp;
        //         normals[i-1] = temp;
        //         normals[i] = temp;
        //         j = 0;
        //     }
        //     j += 1;
            
        // }
        
        // gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
        // gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);
        // gl.bindBuffer(gl.ARRAY_BUFFER, nBuffer);
        // gl.bufferData(gl.ARRAY_BUFFER, flatten(normals), gl.STATIC_DRAW);
        o1.theta = 0;
        o2.theta = 0;
        o1.rpm = normalize(vec3(o2.velocity[0], o2.velocity[1], o2.velocity[2]));
        o2.rpm = normalize(vec3(o1.velocity[0], o1.velocity[1], o1.velocity[2]));
        
    }
}

function updateInfo() {
    var s = document.getElementById("shape");
    var rad = document.getElementById("radius");
    var w = document.getElementById("weight");
    var vx = document.getElementById("velocity x");
    var vy = document.getElementById("velocity y");
    var vz = document.getElementById("velocity z");
    var r = document.getElementById("R");
    var g = document.getElementById("G");
    var b = document.getElementById("B");
    var lx = document.getElementById("Lx");
    var ly = document.getElementById("Ly");
    var lz = document.getElementById("Lz");
    if (s.value !== '') {
        shape = s.value;
    }
    if (vx.value !== '') {
        velocity[0] = parseFloat(vx.value);
    }
    if (vy.value !== '') {
        velocity[1] = parseFloat(vy.value);
    }
    if (vz.value !== '') {
        velocity[2] = parseFloat(vz.value);
    }
    if (r.value !== '') {
        clr[0] = parseFloat(r.value);
    }
    if (g.value !== '') {
        clr[1] = parseFloat(g.value);
    }
    if (b.value !== '') {
        clr[2] = parseFloat(b.value);
    }
    if (rad.value !== '') {
        radius = parseFloat(rad.value);
    }
    if (w.value !== '') {
        weight = parseFloat(w.value);
    }
    if (lx.value !== '') {
        lightpos[0] = parseFloat(lx.value); 
    }
    if (ly.value !== '') {
        lightpos[1] = parseFloat(ly.value); 
    }
    if (lz.value !== '') {
        lightpos[2] = parseFloat(lz.value); 
    }
    //light = gl.getUniformLocation(program, "lightDir");
    gl.uniform3fv(light, lightpos);
}
