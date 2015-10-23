from nmb.NetBIOS import NetBIOS

def queryNam():
        n = NetBIOS(broadcast=True, listen_port=0)
        ip = n.queryIPForName("192.168.40.26", port=137, timeout=1)
        return ip

ip = queryNam()
print ip
