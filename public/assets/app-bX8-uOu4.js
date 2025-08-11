var h=Object.defineProperty,p=(o,e,t)=>e in o?h(o,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):o[e]=t,r=(o,e,t)=>p(o,typeof e!="symbol"?e+"":e,t);class m{constructor(){r(this,"images",[]),r(this,"dropZone"),r(this,"fileInput"),r(this,"imageList"),r(this,"processBtn"),r(this,"progressOverlay"),r(this,"progressFill"),r(this,"progressText"),r(this,"resultsSection"),r(this,"resultsList"),this.dropZone=document.getElementById("dropZone"),this.fileInput=document.getElementById("fileInput"),this.imageList=document.getElementById("imageList"),this.processBtn=document.getElementById("processBtn"),this.progressOverlay=document.getElementById("progressOverlay"),this.progressFill=document.getElementById("progressFill"),this.progressText=document.getElementById("progressText"),this.resultsSection=document.getElementById("results"),this.resultsList=document.getElementById("resultsList"),this.initEventListeners()}initEventListeners(){var s;document.addEventListener("dragenter",i=>i.preventDefault()),document.addEventListener("dragover",i=>i.preventDefault()),document.addEventListener("dragleave",i=>i.preventDefault()),document.addEventListener("drop",i=>i.preventDefault()),this.dropZone.addEventListener("click",()=>this.fileInput.click()),this.dropZone.addEventListener("dragover",this.handleDragOver.bind(this)),this.dropZone.addEventListener("dragleave",this.handleDragLeave.bind(this)),this.dropZone.addEventListener("drop",this.handleDrop.bind(this)),this.fileInput.addEventListener("change",this.handleFileSelect.bind(this)),this.processBtn.addEventListener("click",this.processImages.bind(this)),document.querySelectorAll('input[name="mode"]').forEach(i=>{i.addEventListener("change",this.handleModeChange.bind(this))});const e=document.getElementById("quality"),t=document.getElementById("qualityValue");e.addEventListener("input",()=>{t.textContent=`${e.value}%`}),(s=document.getElementById("downloadAllBtn"))==null||s.addEventListener("click",this.downloadAll.bind(this))}handleDragOver(e){e.preventDefault(),e.stopPropagation(),this.dropZone.classList.add("drag-over")}handleDragLeave(e){e.preventDefault(),e.stopPropagation(),this.dropZone.classList.remove("drag-over")}handleDrop(e){var s;e.preventDefault(),e.stopPropagation(),this.dropZone.classList.remove("drag-over");const t=Array.from(((s=e.dataTransfer)==null?void 0:s.files)||[]);this.addFiles(t)}handleFileSelect(e){const t=e.target,s=Array.from(t.files||[]);this.addFiles(s)}addFiles(e){e.filter(s=>s.type.startsWith("image/")).forEach(s=>{const i=new FileReader;i.onload=d=>{var a;this.images.push({file:s,preview:(a=d.target)==null?void 0:a.result,prefix:""}),this.renderImageList()},i.readAsDataURL(s)})}renderImageList(){if(this.images.length===0){this.imageList.innerHTML="",this.processBtn.disabled=!0;return}this.processBtn.disabled=!1,this.imageList.innerHTML=this.images.map((e,t)=>`
      <div class="image-item" data-index="${t}">
        <img src="${e.preview}" alt="${e.file.name}">
        <div class="image-info">
          <p class="image-name">${e.file.name}</p>
          <p class="image-size">${this.formatFileSize(e.file.size)}</p>
          <input type="text" 
                 class="prefix-input" 
                 placeholder="Präfix (optional)" 
                 data-index="${t}"
                 value="${e.prefix}">
        </div>
        <button class="remove-btn" data-index="${t}">×</button>
      </div>
    `).join(""),this.imageList.querySelectorAll(".prefix-input").forEach(e=>{e.addEventListener("input",t=>{const s=t.target,i=parseInt(s.dataset.index);this.images[i].prefix=s.value})}),this.imageList.querySelectorAll(".remove-btn").forEach(e=>{e.addEventListener("click",t=>{const s=t.target,i=parseInt(s.dataset.index);this.images.splice(i,1),this.renderImageList()})})}handleModeChange(){const e=document.querySelector('input[name="mode"]:checked').value,t=document.getElementById("sizeOptions");e==="resize"||e==="split-resize"?t.style.display="block":t.style.display="none"}async processImages(){if(this.images.length===0)return;const e=document.querySelector('input[name="mode"]:checked').value,t=parseInt(document.getElementById("quality").value),s=parseInt(document.getElementById("width").value)||512,i=parseInt(document.getElementById("height").value)||512,d=document.getElementById("globalPrefix").value||"image",a=new FormData,l=[];this.images.forEach((n,c)=>{a.append("images",n.file),l.push({mode:e,quality:t,width:s,height:i,prefix:n.prefix||d})}),a.append("options",JSON.stringify(l)),this.showProgress();try{const n=await fetch("/api/process",{method:"POST",body:a});if(!n.ok)throw new Error("Fehler bei der Verarbeitung");const c=await n.json();this.showResults(c.results)}catch(n){console.error("Fehler:",n),alert("Fehler bei der Bildverarbeitung")}finally{this.hideProgress()}}showProgress(){this.progressOverlay.style.display="flex",this.animateProgress()}animateProgress(){let e=0;const t=setInterval(()=>{e+=Math.random()*15,e>90&&(clearInterval(t),e=90),this.progressFill.style.width=`${e}%`,this.progressText.textContent=`${Math.round(e)}%`},200)}hideProgress(){this.progressFill.style.width="100%",this.progressText.textContent="100%",setTimeout(()=>{this.progressOverlay.style.display="none",this.progressFill.style.width="0%"},500)}showResults(e){this.resultsSection.style.display="block",this.resultsList.innerHTML=e.map(t=>`
      <div class="result-item">
        <h3>${t.original}</h3>
        <p class="size-info">
          Original: ${this.formatFileSize(t.originalSize)} → 
          Komprimiert: ${this.formatFileSize(t.processed.reduce((s,i)=>s+i.size,0))}
          <span class="savings">
            (${this.calculateSavings(t.originalSize,t.processed.reduce((s,i)=>s+i.size,0))}% gespart)
          </span>
        </p>
        <div class="processed-files">
          ${t.processed.map(s=>`
            <div class="processed-file">
              <span class="file-name">${s.filename}</span>
              <span class="file-size">${this.formatFileSize(s.size)}</span>
              <a href="${s.url}" download="${s.filename}" class="download-btn">
                📥 Download
              </a>
            </div>
          `).join("")}
        </div>
      </div>
    `).join(""),this.resultsSection.scrollIntoView({behavior:"smooth"})}async downloadAll(){const e=this.resultsList.querySelectorAll(".download-btn");for(const t of Array.from(e)){const s=t.href,i=t.download,a=await(await fetch(s)).blob(),l=URL.createObjectURL(a),n=document.createElement("a");n.href=l,n.download=i,document.body.appendChild(n),n.click(),document.body.removeChild(n),URL.revokeObjectURL(l),await new Promise(c=>setTimeout(c,100))}}formatFileSize(e){if(e===0)return"0 Bytes";const t=1024,s=["Bytes","KB","MB","GB"],i=Math.floor(Math.log(e)/Math.log(t));return Math.round(e/Math.pow(t,i)*100)/100+" "+s[i]}calculateSavings(e,t){const s=(e-t)/e*100;return Math.round(s)}}document.addEventListener("DOMContentLoaded",()=>{new m});
