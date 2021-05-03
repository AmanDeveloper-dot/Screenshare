import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import Peer from "simple-peer";
import styled from "styled-components";

const Container = styled.div`
    padding: 20px;
    display: flex;
    height: 100vh;
    width: 90%;
    margin: auto;
    flex-wrap: wrap;
`;

const StyledVideo = styled.video`
    height: 40%;
    width: 50%;
`;

const Video = (props) => {
    const ref = useRef();

    useEffect(() => {
        props.peer.on("stream", stream => {
            ref.current.srcObject = stream;
        })
    }, []);

    return (
        <StyledVideo controls playsInline autoPlay ref={ref} />
    );
}


const videoConstraints = {
    height: window.innerHeight / 2,
    width: window.innerWidth / 2
};

const Room = (props) => {
    const [peers, setPeers] = useState([]);
    const socketRef = useRef();
    const userVideo = useRef();
    const peersRef = useRef([]);
    const roomID = props.match.params.roomID;
    const url = props.location.pathname.split('/');
    //const [isAdmin, setIsAdmin] = useState([url.length > 3 ? true:false]);
    let isAdmin = false;

    if(url.length > 3)
    {
        if(url[3] === 'admin')
        {
            isAdmin = true;
        }
    }
      
    useEffect(() => {
  if(!isAdmin)
    {
        shareScreen();
    }
    else{
        socketRef.current = io.connect("/");
            socketRef.current.emit("join room", roomID);
             socketRef.current.on("all users", users => {
                 const peers = [];
                 users.forEach(userID => {
                     const peer = createPeer(userID, socketRef.current.id);
                     peersRef.current.push({
                         peerID: userID,
                         peer,
                     })
                     peers.push({ 
                         peerID: userID,
                         peer,
                     });
                 })
                 setPeers(peers);
             })

            socketRef.current.on("receiving returned signal", payload => {
                const item = peersRef.current.find(p => p.peerID === payload.id);
                item.peer.signal(payload.signal);
            });
    }
    }, []);

    function shareScreen()
    {
        socketRef.current = io.connect("/");
        navigator.mediaDevices.getDisplayMedia({cursor: true}).then(stream => {
            userVideo.current.srcObject = stream;
            socketRef.current.emit("join room", roomID);
            socketRef.current.on("all users", users => {
                const peers = [];
                users.forEach(userID => {
                    const peer = createPeer(userID, socketRef.current.id, stream);
                    peersRef.current.push({
                        peerID: userID,
                        peer,
                    })
                    peers.push({ 
                        peerID: userID,
                        peer,
                    });
                })
                setPeers(peers);
            })

             socketRef.current.on("user joined", payload => {
                 const peer = addPeer(payload.signal, payload.callerID, stream);
                  peersRef.current.push({
                      peerID: payload.callerID,
                      peer,
                  })

                 const peerObj = {
                     peer,
                     peerID: payload.callerID
                 }


                 setPeers(users => [...users, peerObj]);
             });

            socketRef.current.on("receiving returned signal", payload => {
                const item = peersRef.current.find(p => p.peerID === payload.id);
                item.peer.signal(payload.signal);
            });
        })
    }
    function createPeer(userToSignal, callerID, stream) {
        const peer = new Peer({
            initiator: true,
            trickle: false,
            stream,
        });

        peer.on("signal", signal => {
            socketRef.current.emit("sending signal", { userToSignal, callerID, signal })
        })

        return peer;
    }

    function addPeer(incomingSignal, callerID, stream) {
        const peer = new Peer({
            initiator: false,
            trickle: false,
            stream,
        })

        peer.on("signal", signal => {
            socketRef.current.emit("returning signal", { signal, callerID })
        })

        peer.signal(incomingSignal);

        return peer;
    }

    if(!isAdmin)
    {
        return (
            <div>
                <StyledVideo controls muted ref={userVideo} autoPlay playsInline />    
            </div>
        );

    }
    else{
        return (
            <div>
               {peers.map((peer) => {
                return (
                    <Video controls key={peer.peerID} peer={peer.peer} />
                );
            })}
            </div>
        );
    }
};

export default Room;
