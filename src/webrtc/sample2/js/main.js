// 
var yourId = Math.floor(Math.random()*1000000000);
var roomId;
document.getElementById('name').value = "guest-"+yourId;


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

// firebase.database() 변수
var database4user = null;
var database4room = null;
var database4sdp = null;
var database4ice = null;

document.getElementById('startButton' ).onclick = button_onclick_start;
document.getElementById('hangupButton').onclick = button_onclick_hangup;

var pc; //RTCPeerConnection
var localVideo = document.getElementById('localVideo');
var remoteVideo = document.getElementById('remoteVideo');
var servers = {'iceServers': [{'urls': 'stun:stun.services.mozilla.com'}, 
                              {'urls': 'stun:stun.l.google.com:19302'}, 
                              {'urls': 'turn:numb.viagenie.ca','credential': 'yujin','username': 'yujin@email.com'}]};

// https://www.w3schools.com/tags/av_event_loadedmetadata.asp 참고 
// loadstart -> durationchange -> loadedmetadata -> loadeddata -> progress -> canplay -> canplaythrough 순으로 event가 발생한다고 함. 
localVideo.addEventListener('loadedmetadata', function() {
    console.log('[loadedmetadata]Local video videoWidth: ' + this.videoWidth +'px,  videoHeight: ' + this.videoHeight + 'px');

    database4user = firebase.database().ref(roomId+'/users');
    database4sdp  = firebase.database().ref(roomId+'/sdp');
    database4ice  = firebase.database().ref(roomId+'/ice');

    // https://firebase.google.com/docs/reference/js/firebase.database.Reference#once 참고. 
    // https://firebase.google.com/docs/reference/js/firebase.database.Reference#on 참고. 
    // on method에는 5가지 event가 사용 가능함. value, child_added, child_removed, child_changed, child_moved     
    database4room.once('value'      , database_rooms_once_value); // roomId별로 info에 count정보를 set() 하고 users에 sender 정보를 push()함
    //database4room.on('child_added'  , function(childSnapshot, prevChildKey){});
    //database4room.on('value'        , function(dataSnapshot){});
    //database4room.on('child_removed', function(oldChildSnapshot){});
    //database4room.on('child_changed', function(childSnapshot, prevChildKey){});
    //database4room.on('child_moved'  , function(childSnapshot, prevChildKey){});

    //database4user.on('child_added'  , function(childSnapshot, prevChildKey){});
    //database4user.on('value'        , function(dataSnapshot){});
    database4user.on('child_removed', database_users_on_child_removed);
    //database4user.on('child_changed', function(childSnapshot, prevChildKey){});
    //database4user.on('child_moved'  , function(childSnapshot, prevChildKey){});

    database4ice.on('child_added'  , database_ice_on_child_added);
    database4sdp.on('child_added'  , database_sdp_on_child_added);
});
remoteVideo.addEventListener('loadedmetadata', function() {
    console.log('[loadedmetadata]Remote video videoWidth: ' + this.videoWidth +'px,  videoHeight: ' + this.videoHeight + 'px')
});
window.addEventListener('beforeunload', function(){
    // https://developer.mozilla.org/en-US/docs/Web/Events/unload
    console.log("[beforeunload]where are you going?");
    button_onclick_hangup();
});
window.addEventListener('unload', function(){
    console.log("[unload]where are you going?");
});


/* 방에 입장할 경우 */
function button_onclick_start() {
    console.log('[1][start] Check Room ' + (new Date()) );
    roomId = document.getElementById('room-id').value;
    database4room = firebase.database().ref(roomId+'/info'); 
    // once()에서 firebase.database.ref(...).set(...) 실행함. 
    database4room.once('value'      , database_rooms_once_value_count); // 2명 이상인지 확인
}

function button_onclick_hangup() {
    console.log('[가][hangup] Close RTCPeerConnection ' + (new Date()) );
    if(pc!=null && pc.signalingState!="closed"){
        console.log('[가][hangup] ' + pc.signalingState );
        pc.close(); 
    }
    console.log('[가][hangup] Close RTCPeerConnection .. end');
    if ( database4room != null ){
        database4ice.off('child_added'  , database_ice_on_child_added);
        database4sdp.off('child_added'  , database_sdp_on_child_added);
        database4user.off('child_removed', database_users_on_child_removed);
        database4user.once("value").then(function(dataSnapshot){
            console.log('[나][hangup] Delete user ');
            dataSnapshot.forEach(function(data){
                if( yourId == data.val().sender){
                    firebase.database().ref(roomId+"/users/"+data.key).set(null);
                    roomId = null;
                }
            })
            console.log('[나][hangup] Delete user .. end');
        });
        database4room.once("value").then(function(dataSnapshot){
            console.log('[다][hangup] Change user count');
            if ( dataSnapshot.val().count==1 ){
                database4room.set(null);
            }else{
                database4room.set({count:dataSnapshot.val().count-1});
            }
            console.log('[다][hangup] Change user count .. end');
            //database4user.off('child_removed'  , database_sdp_on_child_added);
        });
    }

    document.getElementById("videos"        ).style.display = "none";
    document.getElementById('localVideo'    ).style = "display:block;"; // 원래대로. 
    document.getElementById("room-selection").style.display = "block";
}

function database_rooms_once_value_count(dataSnapshot){
    if( dataSnapshot.val() != undefined && dataSnapshot.val().count == 2 ){
        alert("방번호를 바꿔서 입장하세요.");
        document.getElementById('room-id').focus();
    }else{
        console.log('[1][start] Check Room ' + roomId + ' .. end');
        console.log('[2][start] Change View ' + (new Date()) );
        document.getElementById('videos'        ).style.display = "block";
        document.getElementById('remoteVideo'   ).style.display = "none";
        document.getElementById('room-selection').style.display = "none";
        console.log('[2][start] Change view .. end');

        console.log('[3][start] Requesting local stream');
        // https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia 참고.
        // https://w3c.github.io/mediacapture-main/getusermedia.html 참고.
        navigator.mediaDevices.getUserMedia({audio:true, video:true}) // MediaStream 객체를 return함. 
        .then( stream => {
            console.log(stream);
            localStream = stream;
            localVideo.srcObject = stream; // localVideo.addEventListener('loadedmetadata', ..) 참고.
            console.log('[3][start] Requesting local stream .. end');
        })
        .catch( error => {
            console.log('[3][start] Requesting local stream .. error ' + error.name);
            console.log(error);
            alert(error);
        })
    }
}
function database_rooms_once_value(dataSnapshot){
    console.log('[4][start] Create a RTCPeerConnection and addTrack');
    // https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection 참고.
    pc = new RTCPeerConnection(servers);
    pc.onaddstream                = pc_onaddstream; //pc.setRemoteDescription() 이 불린 후에 MediaStreamEvent 가 발생함. 
    pc.onconnectionstatechange    = function(e){console.log(e);};//console.log('###[pc][onconnectionstatechange]')
    pc.ondatachannel              = function(e){console.log(e);};//console.log('###[pc][ondatachannel]')
    pc.onicecandidate             = pc_onicecandidate; // Local ICE agent가 signaling server를 통해 message를 deliver 해야할 경우 이벤트가 발생함. 
    pc.oniceconnectionstatechange = function(e){console.log(e);};//console.log('###[pc][oniceconnectionstatechange]')
    // pc.iceConnectionState 값이 바뀌는 경우.
    pc.onicegatheringstatechange  = function(e){console.log(e);};//console.log('###[pc][onicegatheringstatechange]')
    pc.onidentityresult           = function(e){console.log(e);};//console.log('###[pc][onidentityresult]')
    pc.onidpassertionerror        = function(e){console.log(e);};//console.log('###[pc][onidpassertionerror]')
    pc.onidpvalidationerror       = function(e){console.log(e);};//console.log('###[pc][onidpvalidationerror]')
    pc.onnegotiationneeded        = function(e){console.log(e);};//console.log('###[pc][onnegotiationneeded] ' + (new Date()) )
    pc.onpeeridentity             = function(e){console.log(e);};//console.log('###[pc][onpeeridentity]')
    pc.onremovestream             = function(e){console.log(e);};//console.log('###[pc][onremovestream]')
    pc.onsignalingstatechange     = function(e){console.log(e);}; //console.log('###[pc][onsignalingstatechange]')
    //pc.setLocalDescription() 이나 pc.setRemoteDescription() 이 불리면 signalingstatechange 이벤트가 발생됨.
    pc.ontrack                    = function(e){console.log(e);};//console.log('###[pc][ontrack]')

    localStream.getTracks().forEach(function(track) { pc.addTrack(track, localStream); console.log(track); }); 
    // addTrack() 이 되면 negotiationneeded event가 발생하는 걸까?
    console.log('[4][start] Create a RTCPeerConnection and addTrack .. end');

    if( dataSnapshot.val() != undefined ){
        database4room.set({count:dataSnapshot.val().count+1});
        console.log('##[database][once_value      ] modify room info');

        console.log('[5][start] createOffer, setLocalDescription ' + (new Date())); // db added 시점에 createOffer를 하는게 좋겠음. 
        pc.createOffer().then( (offer) => {
            console.log(offer); // RTCSessionDescription 
            return pc.setLocalDescription(offer); // --> signalingstatechange 발생.
        }).then( () => {
            var msg = database4sdp.push({ sender:yourId, message:JSON.stringify({'sdp':pc.localDescription}) });
            msg.remove();
            console.log(pc);
            console.log('[5][start] createOffer .. end');
        });//.catch();
    }else{
        database4room.set({count:1});
        console.log('##[database][once_value      ] create room info');
    }
    database4user.push({sender:JSON.stringify(yourId), url:window.location.href, platform:navigator.platform, userAgent:navigator.userAgent });
}

function database_users_on_child_removed(oldChildSnapshot){
    if ( yourId != oldChildSnapshot.val().sender ){
        console.log('[라][hangup] Catched');
        document.getElementById('localVideo'    ).style = "display:block;"; // 원래대로. 
        document.getElementById('remoteVideo'   ).style = "display:none";
        console.log('[라][hangup] Catched .. end');
    }
}
function database_sdp_on_child_added ( childSnapshot, prevChildKey ){
    var sender = childSnapshot.val().sender;
    var msg = JSON.parse(childSnapshot.val().message);
    if (sender != yourId ) {
        if (msg.sdp.type == "offer") {
            console.log('[6][start] setRemoteDescription, createAnswer, setLocalDescription ' + (new Date()));
            console.log(msg);
            pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
            .then( () => pc.createAnswer() )
            .then( answer => pc.setLocalDescription(answer))
            .then( () => {
                var msg = database4sdp.push({ sender:yourId, message:JSON.stringify({'sdp':pc.localDescription}) });
                msg.remove();                
            });
            console.log('[6][start] setRemoteDescription, createAnswer, setLocalDescription .. end');
        } else if (msg.sdp.type == "answer") {
            console.log('[6][start] setRemoteDescription ' + (new Date()));
            console.log(msg);
            pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            console.log('[6][start] setRemoteDescription .. end');
        }
    }
}

function database_ice_on_child_added ( childSnapshot, prevChildKey ){
    var sender = childSnapshot.val().sender;
    if (sender != yourId) {
        console.log('[7][start] addIceCandidate ' + childSnapshot.val().sender + "/" + yourId);
        var msg = JSON.parse(childSnapshot.val().message);
        console.log(msg);
        pc.addIceCandidate(new RTCIceCandidate(msg.ice));
        console.log('[7][start] addIceCandidate ' + childSnapshot.val().sender + "/" + yourId + ' .. end');
    }
}

function pc_onicecandidate(event) { 
    console.log(event);
    if ( event.candidate ) {
        var msg = database4ice.push({ sender: yourId, message: JSON.stringify({'ice': event.candidate}) });
        msg.remove();
    }else{
        console.log('###[pc][onicecandidate] : sent all ice ' + (new Date()));
    }
}
function pc_onaddstream(event){
    // pc.setRemoteDescription() 이 불리면.. 
    console.log(event); //MediaStreamEvent
    remoteVideo.srcObject = event.stream;
    document.getElementById('remoteVideo'   ).style = "display:block;";
    document.getElementById('localVideo'    ).style = "display:block; width:20%;position:absolute;left:20px;top:20px;";
}
function pc_onremovestream(event){
    console.log(event);
    document.getElementById('localVideo'    ).style = "display:block;"; // 원래대로. 
    document.getElementById('remoteVideo'   ).style = "display:none";
}
