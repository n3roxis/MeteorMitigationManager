import DensityMap from '../components/UI/MapView/resources/DensityMap.png';
//onclick: set(x,y), get (r)/get(circleoffire)/get(circleofpressure)/get(seismiccircle) -> draw circle, collect pixel data within area, calculate range
export const GetPopulationinArea=(x:number,y:number,radius:number):Array<number>=>{

    var image = new Image();
    image.src = DensityMap;
    var canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    var context = canvas.getContext('2d');

    const population:Array<number>=[];
    if (context) {
      context.drawImage(image, 0, 0);
      var imageData = context.getImageData(0, 0, canvas.width, canvas.height);

      let ly=0;
      let my=0;
      let ty=0;
      let O=0;
      let or=0;
      let r=0;
      let dr=0;
      let m=0;
      for(let i=-radius;i<=radius;i++){
          for(let j=-radius;j<=radius;j++){
              if(i*i+j*j<=radius*radius){
                  const color=GetColorOfPixel(imageData,x+i,y+j);
                  
                  switch (color.join(' ')) {
                    case '255 255 190': 
                    ly++;
                    
                    break;
                    case '255 255 115':
                    my++;
                    
                    break;
                    case '255 255 0':
                    ty++;
                    
                    break;
                    case '255 170 0':
                    O++;
                    
                    break;
                    case '255 102 0':
                    or++;
                    
                    break;  
                    case '255 0 0':
                    r++;
                    
                    break;  
                    case '204 0 0':                    
                    dr++;
                    
                    break;  
                    case '115 0 0':
                    m++;
                    
                      break;
                  
                    default:
                      break;
                  }
                  
              }
          }
        }
        console.log(ly,my,ty,O,or,r,dr,m);

        const PopulationLB=ly+my*6+ty*26+O*51+or*101+r*501+dr*2501+m*5001;
        const PopulationUB=ly*5+my*25+ty*50+O*100+or*500+r*2500+dr*5000+m*185000;
        population.push(PopulationLB,PopulationUB);
      }
      return population;
}

const GetColorOfPixel=(context:ImageData,x:number,y:number):Array<number> =>
{
    const imageData:Uint8ClampedArray=context.data;
    const rgb:Array<number>=[imageData[0],imageData[1],imageData[2]];
    return rgb;
}
