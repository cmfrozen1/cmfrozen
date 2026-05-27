const RegisContainer = document.getElementById("RegisContainer");
const showProfileContainer = document.getElementById("showProfile");
const revokeTokenButton = document.getElementById("revokeTokenButton");

const myURL = window.location.origin; //"http://127.0.0.1:5500"
const clientId = "xxxxxxxx"; // channel's client ID
const clientSecret = 'xxxxxxxxxxxxxxxxxxxxxxx';

// button revoke 
revokeTokenButton.addEventListener("click", async () => {
  const accessToken = localStorage.getItem("lineAccessToken"); // Replace with your storage 
  console.log(accessToken)

  if (accessToken) {
    try {
      const body = new URLSearchParams();
      body.append('client_id', clientId);
      body.append('client_secret', clientSecret);
      body.append('access_token', accessToken);
      const response = await fetch("https://api.line.me/oauth2/v2.1/revoke", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: body,
      });

      if (response.ok) {       
        Swal.fire({
          title: 'Are you sure?',
          text: "ต้องการออกจากระบบใช่หรือไม่!",
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#3085d6',
          cancelButtonColor: '#d33',
          confirmButtonText: 'Yes, No!'
        }).then((result) => {
          if (result.isConfirmed) {
            Swal.fire({
                position: 'center',
                icon: 'success',
                title: 'Revoke Token Success',
                showConfirmButton: false,
                timer: 1500
            })
            localStorage.removeItem("lineAccessToken");
            localStorage.removeItem("idToken");
            localStorage.removeItem("lineProfile");            
            window.open(myURL, '_self')
          }
        })
        
      } else {
        alert("revoke access token ผิดพลาด");
      }
    } catch (error) {
      alert("เกิดข้อผิดพลาดขณะดำเนินการ."+error);
    }
  } else {
    alert("ไม่พบ access Token");
  }
});

// เมื่อเปิดหน้า web verifyToken
window.addEventListener("load", async (event) => {
  loadstart()
  const accessToken = localStorage.getItem("lineAccessToken")
  console.log("atoken", accessToken)
  if (accessToken) {
    const statusToken = await verifyToken(accessToken)
    console.log("ok", statusToken)
    if (statusToken.client_id === clientId && statusToken.expires_in > 0) {
      const idToken = localStorage.getItem('idToken')
      let user = parseJwt(idToken)
      const statuschk = chkUser(user, accessToken)
    }
  } else {

    init()
  }
});


async function verifyToken(accessToken) {

  let config = {
    method: 'get',
    maxBodyLength: Infinity,
    url: 'https://api.line.me/oauth2/v2.1/verify?access_token=' + accessToken,
    headers: {}
  };

  let response = await axios.request(config)
  console.log(response.data)
  return response.data

}

function init() {

  // Check if redirected from Line Login and storage the access token
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code");

  if (code) {
    fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: `grant_type=authorization_code&code=${code}&redirect_uri=${myURL}&client_id=${clientId}&client_secret=${clientSecret}` // Replace with your Line channel's client secret
    })
      .then(response => response.json())
      .then(data => {
        console.log(data.id_token)
        const idToken = data.id_token

        const accessToken = data.access_token;

        localStorage.setItem("idToken", JSON.stringify(idToken));
        let user = parseJwt(idToken)

        window.history.pushState({}, document.title, "/") //ซ่อน param

        const statuschk = chkUser(user, accessToken)
      })
      .catch(error => {
        alert("error login." + error);
      });
  }
}


function parseJwt(token) {
  var base64Url = token.split('.')[1];
  var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');

  var jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));

  return JSON.parse(jsonPayload);
}

// let otp;
async function addHitoryLogin(user) {
  let dateExp = new Date(user.exp * 1000).toLocaleString()
  console.log(dateExp)

  const URL = "https://script.google.com/macros/s/AKfycbxQqZlvdn9LMimCI4PB6tCic04tdy3sFYpzNEl93HEFRZj57yLHQzJgc59CxQUrERGJ/exec"
  let sendObj = {}
  sendObj.uidUser = user.sub
  sendObj.expUser = dateExp
  sendObj.nameUser = user.name
  sendObj.emailUser = user.email
  sendObj.pictureUser = user.picture

  const formData = new FormData();
  formData.append('objs', JSON.stringify(sendObj))
  console.log(formData)
  const response = await fetch(URL + "?type=create", {
    method: 'POST',
    body: formData
  });
  const json = await response.json()
  console.log(json)
//   otp = json.otp
//   console.log(otp)
  return json
}

async function chkUser(user, accessToken) {
  let dateExp = new Date(user.exp * 1000).toLocaleString()
  console.log(dateExp)

  const URL = "https://script.google.com/macros/s/AKfycbxQqZlvdn9LMimCI4PB6tCic04tdy3sFYpzNEl93HEFRZj57yLHQzJgc59CxQUrERGJ/exec"
  let fObj = {}
  fObj.uidUser = user.sub
  fObj.expUser = dateExp
  fObj.nameUser = user.name
  fObj.emailUser = user.email
  fObj.pictureUser = user.picture

  const formData = new FormData();
  formData.append('objs', JSON.stringify(fObj))
  console.log(formData)
  const response = await fetch(URL + "?type=check", {
    method: 'POST',
    body: formData
  });
  const json = await response.json()
  console.log(json)
  let rescheck = false
 
        if (json.status === "400") {
            value = user.email
        loadend() 
            // sweet Regis
            const { value: formValues } = await Swal.fire({
            title: 'กรุณา ลงทะเบียนกับเราเพื่อเข้าใช้งาน',
            html:
            `<input id="swal-input1" value ="${user.email}" class="swal2-input">` +
            '<input id="swal-input2" placeholder="รู้จักเราจากช่องทางใด" class="swal2-input" >',
            focusConfirm: false,
            preConfirm: () => {
            return [
                document.getElementById('swal-input1').value,
                document.getElementById('swal-input2').value
            ]
            }
        })
        
        if (formValues) {
            addRegister(formValues)
        }
        } else {
            loadend()
            // let reshistory = await addHitoryLogin(user)
            // console.log("res ", reshistory.otp)
            // const { value: password } = await Swal.fire({
            // title: 'Plese get Passcode from inbox Email '+user.email,
            // input: 'password',
            // inputLabel: 'เพื่อเป็นการยืนยันสิทธิ์การใช้งานกรุณาตรวจสอบ อีเมลล์ และรับรหัสยืนยัน',
            // inputPlaceholder: 'Enter your Passcode',
            // inputAttributes: {
            //     maxlength: 10,
            //     autocapitalize: 'off',
            //     autocorrect: 'off'
            // }
            // })

            // if (password === reshistory.otp) {
            // loginContainer.style.display = "none";
            document.getElementById("pageHidden").style.display = "block";    
            Swal.fire({
                title: 'ยินดีต้อนรับ!',
                text: ' Test Line Login ',
                imageUrl: 'https://unsplash.it/400/200',
                imageWidth: 400,
                imageHeight: 200,
                imageAlt: 'Custom image',
            })

            localStorage.setItem("lineAccessToken", accessToken);
            localStorage.setItem("lineProfile", JSON.stringify(user));
            
            const strprofile = localStorage.getItem("lineProfile");
            const objprofile = JSON.parse(strprofile)

            document.getElementById("showa").innerHTML = objprofile.email
            document.getElementById("imgprofile").src = objprofile.picture
            document.getElementById("showb").innerHTML = objprofile.name
            rescheck = true
            // } else {
            // Swal.fire(
            //     'ลงทะเบียนไม่ถูกต้อง',
            //     'You Register Fail',
            //     'error'
            // )
            // return window.open(myURL, '_self')
            // }
        }
  return rescheck
}

async function addRegister(formdata) {
  if (formdata[0] !== "" && formdata[1] !== "") {
    const URL = "https://script.google.com/macros/s/AKfycbxQqZlvdn9LMimCI4PB6tCic04tdy3sFYpzNEl93HEFRZj57yLHQzJgc59CxQUrERGJ/exec"
    let fObj = {}
    fObj.emailuser = formdata[0]
    fObj.passcode = formdata[1]

    const formData = new FormData();
    formData.append('objs', JSON.stringify(fObj))
    console.log(formData)
    const response = await fetch(URL + "?type=regis", {
      method: 'POST',
      body: formData
    });
    const json = await response.json()
    console.log(json)
    if (json.status === "success") {
        Swal.fire({
            position: 'top-end',
            icon: 'success',
            title: 'Your work has been saved',
            showConfirmButton: false,
            timer: 1500
        })
      window.open(myURL, '_self')
    }
  } else {
    Swal.fire(
      'ลงทะเบียนไม่ถูกต้อง',
      'You Register Fail',
      'error'
    )
    return
  }
}


function loadstart() {
  document.querySelector(".loader-container").style.display = "block";
}
function loadend() {
  document.querySelector(".loader-container").style.display = "none";
}
