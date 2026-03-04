// Simplex noise 3D + curl noise — used by the DJ board simulation shader.
// Curl noise source: https://github.com/drcmda/glsl-curl-noise2
export const curlNoiseGLSL = `
  vec3 dmod289(vec3 x){return x-floor(x*(1./289.))*289.;}
  vec4 dmod289v(vec4 x){return x-floor(x*(1./289.))*289.;}
  vec4 dpermute(vec4 x){return dmod289v(((x*34.)+1.)*x);}
  vec4 dtaylor(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1./6.,1./3.);
    const vec4 D=vec4(0.,.5,1.,2.);
    vec3 i=floor(v+dot(v,C.yyy));
    vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);
    vec3 l=1.-g;
    vec3 i1=min(g.xyz,l.zxy);
    vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;
    vec3 x2=x0-i2+C.yyy;
    vec3 x3=x0-D.yyy;
    i=dmod289(i);
    vec4 p=dpermute(dpermute(dpermute(
      i.z+vec4(0.,i1.z,i2.z,1.))
      +i.y+vec4(0.,i1.y,i2.y,1.))
      +i.x+vec4(0.,i1.x,i2.x,1.));
    float n_=.142857142857;
    vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.*floor(p*ns.z*ns.z);
    vec4 x_=floor(j*ns.z);
    vec4 y_=floor(j-7.*x_);
    vec4 x2_=x_*ns.x+ns.yyyy;
    vec4 y2_=y_*ns.x+ns.yyyy;
    vec4 h=1.-abs(x2_)-abs(y2_);
    vec4 b0=vec4(x2_.xy,y2_.xy);
    vec4 b1=vec4(x2_.zw,y2_.zw);
    vec4 s0=floor(b0)*2.+1.;
    vec4 s1=floor(b1)*2.+1.;
    vec4 sh=-step(h,vec4(0.));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
    vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);
    vec3 p1=vec3(a0.zw,h.y);
    vec3 p2=vec3(a1.xy,h.z);
    vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=dtaylor(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
    vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
    m=m*m;
    return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }
  vec3 snoiseVec3(vec3 x){
    return vec3(snoise(x),snoise(x+vec3(-19.1,33.4,47.2)),snoise(x+vec3(74.2,-124.5,99.4)));
  }
  vec3 curlNoise(vec3 p){
    const float e=.1;
    vec3 dx=vec3(e,0.,0.),dy=vec3(0.,e,0.),dz=vec3(0.,0.,e);
    vec3 px0=snoiseVec3(p-dx),px1=snoiseVec3(p+dx);
    vec3 py0=snoiseVec3(p-dy),py1=snoiseVec3(p+dy);
    vec3 pz0=snoiseVec3(p-dz),pz1=snoiseVec3(p+dz);
    float x=py1.z-py0.z-pz1.y+pz0.y;
    float y=pz1.x-pz0.x-px1.z+px0.z;
    float z=px1.y-px0.y-py1.x+py0.x;
    return normalize(vec3(x,y,z)*(1./(2.*e)));
  }
`;
