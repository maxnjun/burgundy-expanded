import Link from "next/link";
import type {MonasteryNumber} from "../../game/types";
import assets from "../../../public/assets/tiles/monastery/final/manifest.json";
import { ESTATE_ART_HEIGHT } from "../estate-geometry";
import { TileArt } from "../tile-art";

export default function MonasteryGallery() {
  return <main style={{maxWidth:1200,margin:"auto",padding:24,color:"#49331d",background:"#efe2c3"}}>
    <Link href="/">게임으로 돌아가기</Link>
    <h1>수도원 타일 1~29</h1>
    <p>승인된 그림과 번호를 그대로 사용합니다. 큰 그림과 실제 게임 크기를 함께 비교할 수 있습니다.</p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:16}}>
      {assets.assets.map(asset=><figure key={asset.number} style={{margin:0,textAlign:"center",padding:8,border:"1px solid #bca574",borderRadius:4}}>
        <figcaption>수도원 {asset.number}번</figcaption>
        <TileArt tile={{id:`monastery-gallery-${asset.number}`,type:"monastery",number:asset.number as MonasteryNumber,back:"matching-color"}} style={{display:"block",width:"100%",height:"auto"}}/>
        <TileArt tile={{id:`monastery-small-${asset.number}`,type:"monastery",number:asset.number as MonasteryNumber,back:"matching-color"}} width={72} height={72*ESTATE_ART_HEIGHT/100}/>
      </figure>)}
    </div>
  </main>;
}
