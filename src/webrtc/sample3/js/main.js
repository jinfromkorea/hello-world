// 
var yourId = Math.floor(Math.random()*1000000000);
var roomId;
var servers = {'iceServers': [{'urls': 'stun:stun.services.mozilla.com'}, 
                              {'urls': 'stun:stun.l.google.com:19302'}, 
                              {'urls': 'turn:numb.viagenie.ca','credential': 'yujin','username': 'yujin@email.com'}]};
var cameraCnt = 0; //스마트폰의 경우 전방/후방 카마레가 있음.
var micCnt = 0;
var cameraFront = true;
var micOn = true; 
var videoOn = true;
var dataChannelOn = false;
var videoConstraints;
// Initialize Firebase
var config = {
    apiKey: "AIzaSyDKEYRybMQOAkpMZp2F3bTvQFboa2VJgrI",
    authDomain: "test-webrtc-56501.firebaseapp.com",
    databaseURL: "https://test-webrtc-56501.firebaseio.com",
    projectId: "test-webrtc-56501",
    storageBucket: "test-webrtc-56501.appspot.com",
    messagingSenderId: "1044697177062"
  };
firebase.initializeApp(config);
console.log('[init] firebase.initializeApp()');
firebase.auth().onAuthStateChanged(function(user) {
  if (user) {
    document.getElementById('logon_email').innerHTML = user.email;
    // User is signed in.
    document.getElementById('login_page').style.display = "none";
    document.getElementById('room_page').style.display = "block";
    console.log(user)
  } else {
    document.getElementById('login_page').style.display = "block";
    // No user is signed in.
  }
});

// iPhone iOS의 버전이 11이상이어야 webrtc 사용가능. 그래서 navigator.mediaDevices 가 없을수 있음. 
if( navigator.mediaDevices != undefined ) 
    navigator.mediaDevices.enumerateDevices().then( deviceInfos => { 
        deviceInfos.forEach( deviceInfo => { 
            if(deviceInfo.kind=='videoinput'){cameraCnt++}
            else if(deviceInfo.kind=='audioinput'){micCnt++} 
        } ); 
        console.log(deviceInfos);
    } ).catch( error => console.log(error) );
else {
    console.log('지원하지 않는 기기 입니다.');
    location.href='./not_supported.html';
}

var database4usr = null; // firebase.database() 변수
var database4sdp = null; // firebase.database() 변수
var database4ice = null; // firebase.database() 변수
var pc; //RTCPeerConnection 변수
var dc; //RTCDataChannel 변수
var localStream = null;

document.getElementById('startButton' ).onclick = button_onclick_start; // 입장 버튼 
document.getElementById('hangupButton').onclick = button_onclick_hangup; // 나가기 버튼
document.getElementById('cameraButton').onclick = button_onclick_camera; // 전후방 카메라 전환 버튼
document.getElementById('micButton'   ).onclick = button_onclick_mic;    // 마이스 enable/disable 전환 버튼
document.getElementById('videoButton' ).onclick = button_onclick_video;  // 비디오 enable/disable 전환 버튼 
document.getElementById('textButton'  ).onclick = button_onclick_text;   // 텍스트창 버튼  
document.getElementById('mediaButton' ).onclick = button_onclick_text;   // 텍스트창 버튼  
document.getElementById('sendButton'  ).onclick = button_onclick_send;   //
document.getElementById('signup'      ).onclick = button_onclick_signup; // 가입(SignUp) 버튼 
document.getElementById('signin'      ).onclick = button_onclick_signin; // 로그인 버튼 
document.getElementById('signout'     ).onclick = button_onclick_signout; // 로그아웃 버튼. 
document.getElementById('inviteButton').onclick = function(){console.log('not yet')}; // 초대 버튼
//document.getElementById('localVideo' ).onloadstart = function(){console.log('<video/> onloadstart')}
//document.getElementById('localVideo' ).ondurationchange = function(){console.log('<video/> ondurationchange')}
document.getElementById('localVideo' ).onloadedmetadata = video_onloadedmetadata_start_local;
//document.getElementById('localVideo' ).onloadeddata = function(){console.log('<video/> onloadeddata')}
//document.getElementById('localVideo' ).onprogress = function(){console.log('<video/> onprogress')} //로그가 많이 나오고 순서가 다름. 
//document.getElementById('localVideo' ).oncanplay = function(){console.log('<video/> oncanplay')}
//document.getElementById('localVideo' ).oncanplaythrough = function(){console.log('<video/> oncanplaythrough')}
document.getElementById('remoteVideo').onloadedmetadata = video_onloadedmetadata_start_remote;
window.onunload = function(){ console.log("[unload]where are you going?")};
window.onbeforeunload = button_onclick_hangup; //window.addEventListener('beforeunload', button_onclick_hangup); 와 같음. 

// https://www.w3schools.com/tags/av_event_loadedmetadata.asp 참고 
// loadstart -> durationchange -> loadedmetadata -> loadeddata -> progress -> canplay -> canplaythrough 순으로 event가 발생한다고 함. 


/* 방에 입장할 경우 */
function button_onclick_start() {
    console.log('[입장][1] Check Room ' + (new Date()) );
    if( document.getElementById('room-id').value == "" ){
        document.getElementById('room-id').value = Math.floor(Math.random()*1000);
    }
    roomId = '_' + document.getElementById('room-id').value;
    document.querySelector('#roomInfo span').innerHTML = document.getElementById('room-id').value;
    // https://firebase.google.com/docs/reference/js/firebase.database.Reference#once 참고. 
    // https://firebase.google.com/docs/reference/js/firebase.database.Reference#on 참고. 
    // on method에는 5가지 event가 사용 가능함. value, child_added, child_removed, child_changed, child_moved     
    // database4usr.once('value'      , function(dataSnapshot){});
    // database4usr.on('child_added'  , function(childSnapshot, prevChildKey){});
    // database4usr.on('value'        , function(dataSnapshot){});
    // database4usr.on('child_removed', function(oldChildSnapshot){});
    // database4usr.on('child_changed', function(childSnapshot, prevChildKey){});
    // database4usr.on('child_moved'  , function(childSnapshot, prevChildKey){});
    database4usr = firebase.database().ref(roomId+'/users');
    database4sdp = firebase.database().ref(roomId+'/sdp');
    database4ice = firebase.database().ref(roomId+'/ice');
    database4usr.on('child_removed', database_users_on_child_removed);
    database4sdp.on('child_added'  , database_sdp_on_child_added);
    database4ice.on('child_added'  , database_ice_on_child_added);
    database4usr.once('value').then(function(dataSnapshot){ //asnyc#1
        var cnt = 0;
        dataSnapshot.forEach( data => cnt++ );
        if( cnt < 2 ){
            database4usr.push({ 
                sender:JSON.stringify(yourId), 
                url:window.location.href, 
                platform:navigator.platform, 
                userAgent:navigator.userAgent, 
                started:firebase.database.ServerValue.TIMESTAMP
            });
            console.log('[입장][1] Check Room : ' + document.getElementById('room-id').value + ' has ' + cnt + ' users');

            console.log('[입장][2] Requesting local stream');
            document.getElementById('room_page').style.display = "none";
            document.getElementById('video_page').style.display = "block";
            document.getElementById('remoteVideo').style.display = "none";
            // https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia 참고.
            // https://w3c.github.io/mediacapture-main/getusermedia.html 참고.
            navigator.mediaDevices.getUserMedia({audio:true, video:true}) // MediaStream 객체를 return함. 
            .then( stream => {
                console.log(stream); // MediaStream
                localStream = document.getElementById('localVideo').srcObject = stream; // localVideo.addEventListener('loadedmetadata', ..) 참고.
                console.log('[입장][2] Requesting local stream .. end');

                console.log('[입장][3] Create a RTCPeerConnection');
                _createPeerConnection();
                console.log('[입장][3] Create a RTCPeerConnection .. end');
            }).catch( error => {
                console.log('[입장][2] Requesting local stream .. error ' + error.name);
                console.log(error);
            });

        }else{
            alert("사용할 수 없는 방법호 입니다.");
            document.getElementById('room-id').focus();
        }
    });
}
function _createPeerConnection(){
    // https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection 참고.
    pc = new RTCPeerConnection(servers);
    // onaddstream은 deprecated되어서 ontrack을 사용해야함. 
    //pc.setLocalDescription() 이나 pc.setRemoteDescription() 이 불리면 signalingstatechange 이벤트가 발생됨.
    pc.onconnectionstatechange    = function(e){console.log(e);};
    pc.ondatachannel              = function(e){console.log(e);};
    pc.onicecandidate             = function(e){console.log(e); //RTCPeerConnectionIceEvent
        // Local ICE agent가 signaling server를 통해 message를 deliver 해야할 경우 이벤트가 발생함. 
        if ( e.candidate ) {
            var msg = database4ice.push({ sender: yourId, message: JSON.stringify({'ice': e.candidate}) });
            msg.remove();
        }else{
            console.log('###[pc][onicecandidate] : sent all ice ' + (new Date()));
        }
    };
    pc.oniceconnectionstatechange = function(e){console.log(e);};
    pc.onicegatheringstatechange  = function(e){console.log(e);};
    pc.onidentityresult           = function(e){console.log(e);};
    pc.onidpassertionerror        = function(e){console.log(e);};
    pc.onidpvalidationerror       = function(e){console.log(e);};
    pc.onnegotiationneeded        = function(e){console.log(e);};
    pc.onpeeridentity             = function(e){console.log(e);};
    pc.onremovestream             = function(e){console.log(e);};
    pc.onsignalingstatechange     = function(e){console.log(e);};
    pc.ontrack                    = function(e){console.log(e); //MediaStreamEvent
        document.getElementById('remoteVideo').srcObject = e.streams[0];
        document.getElementById('remoteVideo').style = "display:block;";
        document.getElementById('localVideo' ).style = "display:block; width:20%;position:absolute;left:20px;top:20px;border-radius:10px";
    };

    dc = pc.createDataChannel("dataChannel", {negotiated:true, id:0}); // id가 있어야 함. 
    dc.onbufferedamountlow = function(e){console.log(e)};
    dc.onclose             = function(e){console.log(e)};
    dc.onerror             = function(e){console.log(e)};
    dc.onmessage           = function(e){console.log(e);
        var receivedData = JSON.parse(e.data); console.log(receivedData);
        if( receivedData.cmd == 'open'){
            console.log('[MSG] Change Icon');
            dataChannelOn = !dataChannelOn;
            document.getElementById('perm_phone_msg').style.display = dataChannelOn ? 'none':'block';
            document.querySelector("button#fileButton").disabled = !dataChannelOn;
            document.getElementById('media').style.display = dataChannelOn ? 'none':'block';
            document.getElementById('data').style.display = dataChannelOn ? 'block':'none';
            console.log('[MSG] Change Icon .. end');
            _updateMessageBox( true, false, '채팅이 시작되었습니다.' );
        }else if(receivedData.cmd == 'chat'){
            _updateMessageBox( false, false, receivedData.msg );
        }
    };
    dc.onopen              = function(e){console.log(e);
        dc.send(JSON.stringify({'user': yourId}));
    };
}
function _updateMessageBox( isInit, isMine, msg ){
    if( isInit ){
        document.getElementById('messageBox').style.height = (document.documentElement.clientHeight - document.getElementById('data').offsetTop*2 - 20 - 10) + 'px';
        document.getElementById('messageBox').childNodes.forEach( node => node.remove() );
        document.getElementById('msg').style.width = ( document.documentElement.clientWidth - document.getElementById('sendButton').clientWidth - 10 - 20 ) + 'px';
    }
    var el = document.createElement("p");
    el.style.textAlign = isMine ? 'right':'left';
    var textNode = document.createTextNode(msg);
    el.appendChild(textNode);
    document.getElementById('messageBox').appendChild(el);
}
function button_onclick_text(){
    console.log('[MSG] Change Icon');
    dataChannelOn = !dataChannelOn;
    document.getElementById('perm_phone_msg').style.display = dataChannelOn ? 'none':'block';
    document.getElementById('media').style.display = dataChannelOn ? 'none':'block';
    document.getElementById('data').style.display = dataChannelOn ? 'block':'none';
    dc.send(JSON.stringify({'user': yourId, 'cmd':'open', 'cameraFront':cameraFront}));
    console.log('[MSG] Change Icon .. end');
    _updateMessageBox( true, false, dataChannelOn?'채팅이 시작되었습니다.':'채팅이 종료되었습니다.' );
}
function button_onclick_send(){
    var msg = document.getElementById('msg').value;
    document.getElementById('msg').value = ''; // 입력창은 지워주고.. 
    _updateMessageBox( false, true, msg  );
    dc.send(JSON.stringify({'user': yourId, 'cmd':'chat', 'msg': '' + msg }));
}

function video_onloadedmetadata_start_local() {
    console.log('<video/> onloadedmetadata -> videoWidth: ' + this.videoWidth +'px,  videoHeight: ' + this.videoHeight + 'px');
    console.log('<video/> onloadedmetadata : addTrack on pc(RTCPeerConnection)');
    localStream.getTracks().forEach( track => { pc.addTrack(track, localStream); console.log(track); } );//MediaStreamTrack
    // addTrack() 이 되면 negotiationneeded event가 발생하는 걸까?

    document.getElementById('cameraButton').style.display = cameraCnt > 1 ? "block" : "none";
    document.getElementById('micButton').style.display = micCnt > 0 ? "block":"none";
    document.getElementById('videoButton').style.display = "block";
    database4usr.once('value', _createOff);
}
function _createOff(dataSnapshot){
    var cnt = 0;
    dataSnapshot.forEach( data => cnt++ );
    if( cnt == 2 ){
        console.log('[입장][4] createOffer on pc(RTCPeerConnection)');
        // db added 시점에 createOffer를 하는게 좋겠음. 
        pc.createOffer().then( offer => {
            console.log(offer); // RTCSessionDescription 
            console.log('[입장][4] createOffer -> setLocalDescription(RTCSessionDescription)');
            return pc.setLocalDescription(offer); // --> signalingstatechange 발생.
        }).then( () => {
            var msg = database4sdp.push({ sender:yourId, message:JSON.stringify({'sdp':pc.localDescription}) });
            msg.remove();
        });
    }
}
function database_sdp_on_child_added ( childSnapshot, prevChildKey ){
    var sender = childSnapshot.val().sender;
    var msg = JSON.parse(childSnapshot.val().message);
    if ( sender != yourId && msg.sdp.type == "offer" ) {
        console.log('[입장][5] setRemoteDescription');
        pc.setRemoteDescription(new RTCSessionDescription(msg.sdp) ).then( () => { 
            console.log('[입장][5] setRemoteDescription -> createAnswer');
            return pc.createAnswer();
        }).then( answer => { 
            console.log(answer); // RTCSessionDescription 
            console.log('[입장][5] setRemoteDescription -> createAnswer -> setLocalDescription'); 
            return pc.setLocalDescription(answer);
        }).then( () => {
            var msg = database4sdp.push({ sender:yourId, message:JSON.stringify({'sdp':pc.localDescription}) });
            msg.remove();                
        });
    } else if ( sender != yourId && msg.sdp.type == "answer") {
        console.log('[입장][4] createOffer -> setLocalDescription(RTCSessionDescription) -> setRemoteDescription(RTCSessionDescription)');
        pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
    }
}
function video_onloadedmetadata_start_remote(){
    console.log('<video/> onloadedmetadata -> videoWidth: ' + this.videoWidth +'px,  videoHeight: ' + this.videoHeight + 'px');
    document.querySelector("button#textButton").style.display = "block";
    document.querySelector("button#textButton").disabled = false;
}


function button_onclick_hangup() {
    if( pc!=null && pc.signalingState!="closed" ){
        console.log('[나가기][1] Close RTCPeerConnection' );
        pc.close();
    }
    if( localStream!= null ){
        console.log('[나가기][2] Stop localStream' );
        localStream.getTracks().forEach( track => { track.stop(); } );
        localStream = null;
    }
    firebase.database().ref(".info/connected").on("value", function(snapshot) {
        if( snapshot.val() === true ){
            database4usr.off('child_removed', database_users_on_child_removed);
            database4usr.once("value").then(function(dataSnapshot){
                console.log('[나가기][3] Delete user');
                dataSnapshot.forEach( data => {
                    if( yourId == data.val().sender){
                        firebase.database().ref(roomId+"/users/"+data.key).set(null);
                        roomId = null;
                    }
                })
            });
            database4ice.off('child_added'  , database_ice_on_child_added);
            database4sdp.off('child_added'  , database_sdp_on_child_added);
        }
    });

    document.getElementById('room_page').style.display = "block";
    document.getElementById('video_page').style.display = "none";
    document.getElementById('localVideo'    ).style = "display:block;"; // 원래대로. 
    document.querySelector("button#textButton").style.display = "none";
}
function button_onclick_camera(){
    console.log('[Camera] Change Icon');
    cameraFront  = !cameraFront;
    document.getElementById('camera_front').style.display = cameraFront ? 'none':'block';
    document.getElementById('camera_rear' ).style.display = cameraFront ? 'block':'none';
    console.log('[Camera] Change Icon .. end');
    console.log('[Camera] Requesting local stream');
    videoConstraints = { audio:true, video: { facingMode: (cameraFront ? "user" : "environment") } };
    navigator.mediaDevices.getUserMedia(videoConstraints) // MediaStream 객체를 return함. 
    .then( stream => {
        console.log(stream);
        console.log(localStream);
        pc.removeStream(localStream);
        localStream = document.getElementById('localVideo').srcObject = stream; // localVideo.addEventListener('loadedmetadata', ..) 참고.
        document.getElementById('localVideo').style.transform = cameraFront ? 'scaleX(-1)' : 'scaleX(1)'; // localVideo.addEventListener('loadedmetadata', ..) 참고.
        console.log('[Camera] Requesting local stream .. end');
    }).catch( error => {
        console.log('[Camera] Requesting local stream .. error ' + error.name);
        console.log(error);
    })
}

function button_onclick_mic(){
    console.log('[Mic] Change Icon');
    micOn = !micOn;
    document.getElementById('mic'    ).style.display = micOn ? 'none':'block';
    document.getElementById('mic_off').style.display = micOn ? 'block':'none';
    console.log('[Mic] Change Icon .. end');
    pc.getSenders().forEach( sender => {
        if(sender.track.kind == 'audio'){ sender.track.enabled = !sender.track.enabled }
    });
}
function button_onclick_video(){
    console.log('[Video] Change Icon');
    videoOn = !videoOn;
    document.getElementById('videocam'    ).style.display = videoOn ? 'none':'block';
    document.getElementById('videocam_off').style.display = videoOn ? 'block':'none';
    console.log('[Video] Change Icon .. end');
    pc.getSenders().forEach( sender => {
        if(sender.track.kind == 'video'){ sender.track.enabled = !sender.track.enabled }
    });
}

function database_users_on_child_removed(oldChildSnapshot){
    if ( yourId != oldChildSnapshot.val().sender ){
        console.log('[나가기][4] Delete user');
        document.getElementById('localVideo'    ).style = "display:block;"; // 원래대로. 
        document.getElementById('remoteVideo'   ).style = "display:none";
        document.getElementById('remoteVideo').srcObject = null;
        document.querySelector("button#textButton").style.display = "none";
        document.querySelector("button#textButton").disabled = true;
        document.querySelector("button#fileButton").disabled = true;
        _createPeerConnection();
        console.log('[나가기][5] addTrack on pc(RTCPeerConnection)');
        localStream.getTracks().forEach( track => { pc.addTrack(track, localStream); console.log(track); } );//MediaStreamTrack
    }
}
function database_ice_on_child_added ( childSnapshot, prevChildKey ){
    var sender = childSnapshot.val().sender;
    if (sender != yourId) {
        var msg = JSON.parse(childSnapshot.val().message);
        console.log('[firebase] addIceCandidate from remote');
        pc.addIceCandidate(new RTCIceCandidate(msg.ice));
    }
}


function button_onclick_signup(){
    email = document.getElementById('signup_email').value;
    password = document.getElementById('singup_password').value;
    firebase.auth().createUserWithEmailAndPassword(email, password).then( () => {document.getElementById('signup_page').style.display = "none";}).catch(error => {console.log(error);alert(error.message)});
}
function button_onclick_signin(){
    email = document.getElementById('email').value;
    password = document.getElementById('password').value;
    firebase.auth().signInWithEmailAndPassword(email, password).catch(error => {
        console.log(error);alert(error.message);
        if(error.code=='auth/user-not-found'){
            document.getElementById('signup_page').style.display = "block";
            document.getElementById('login_page').style.display = "none";
            document.getElementById('signup_email').value = document.getElementById('email').value;
        }
    });
}
function button_onclick_signout(){
    document.getElementById('room_page').style.display = "none";
    firebase.auth().signOut().then( () => console.log("sign out") ).catch(error=> console.log(error));
}
