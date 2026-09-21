/* DSA prototype used alongside the full-stack web application.
   The web application stores data in SQLite; this C file demonstrates the DSA layer.
*/
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#define MAX_PGS 100

typedef struct {int id; char name[60]; char locality[60]; int rent; int students; int vacancy; float distance; char location[100];} PG;
PG pgs[MAX_PGS]; int n=0;
void addPG(int id,const char*name,const char*locality,int rent,int students,int vacancy,float distance,const char*location){if(n>=MAX_PGS)return;pgs[n].id=id;strcpy(pgs[n].name,name);strcpy(pgs[n].locality,locality);pgs[n].rent=rent;pgs[n].students=students;pgs[n].vacancy=vacancy;pgs[n].distance=distance;strcpy(pgs[n].location,location);n++;}
void display(PG p){printf("\n[%d] %s | %s | Rs. %d/month | %d students | %d vacancy | %.1f km | %s\n",p.id,p.name,p.locality,p.rent,p.students,p.vacancy,p.distance,p.location);}
void listAvailable(){printf("\n--- AVAILABLE PGs ---\n");for(int i=0;i<n;i++)if(pgs[i].vacancy>0)display(pgs[i]);}
void linearSearch(const char*key){printf("\n--- SEARCH: %s ---\n",key);int found=0;for(int i=0;i<n;i++)if(strstr(pgs[i].name,key)||strstr(pgs[i].locality,key)){display(pgs[i]);found=1;}if(!found)printf("No matching PG found.\n");}
int cmp(const void*a,const void*b){PG*x=(PG*)a,*y=(PG*)b;return x->rent-y->rent;}
void sortByRent(){qsort(pgs,n,sizeof(PG),cmp);printf("\n--- SORTED BY RENT ---\n");for(int i=0;i<n;i++)if(pgs[i].vacancy>0)display(pgs[i]);}
int main(){addPG(1,"Green View PG","College Road",6500,3,1,.7,"Near Main Gate");addPG(2,"Student Square","University Chowk",5500,2,2,1.2,"Opposite City Library");addPG(3,"Maple Residency","Shivaji Nagar",8500,2,1,2.1,"Shivaji Nagar Bus Stop");addPG(4,"Campus Corner","College Road",4800,3,1,.9,"Near College Road");printf("CampusNMIET DSA Prototype\n");listAvailable();linearSearch("College");sortByRent();return 0;}
