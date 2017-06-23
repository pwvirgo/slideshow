package slideshow;

import javax.swing.*; 
import java.awt.*; 
import java.awt.event.MouseEvent;
import java.awt.event.MouseListener;
import java.awt.image.BufferedImage; 
import java.util.logging.Logger;

// https://docs.oracle.com/javase/tutorial/2d/images/drawimage.html

public class Gui extends JPanel implements MouseListener
{
	static final Logger log = Logger.getLogger( "slideshow.Gui2" );
  private static BufferedImage image; 
  private static final JFrame frame = new JFrame("Slipin an slidin");
	private SlideMenu slideMenu = new SlideMenu(this);
	
  public Gui () { 
		super();
		addMouseListener(this);
		add(slideMenu);
	}
	
	@Override public void mouseClicked(MouseEvent e) {
		log.info("clicked!");
		//slideMenu.setVisible(true);
		slideMenu.show(this, 20, 20);
	}

	@Override public void mousePressed(MouseEvent e) {}
	@Override  public void mouseReleased(MouseEvent e) {}
	@Override public void mouseEntered(MouseEvent e) {}
	@Override public void mouseExited(MouseEvent e) {}

	
	//  question  what about g.dispose ???? 
	//	
  //BufferedImage resizedImage = new BufferedImage(new_width, new_height, BufferedImage.TYPE_INT_ARGB); 
  //Graphics2D g = resizedImage.createGraphics();
  //g.drawImage(image, 0, 0, new_width, new_height, null);
  //g.dispose();
	

	
	@Override
	public void paintComponent(Graphics g) 
  { 
		
		setBackground(Color.black); // doesn;t work after resizing 
		
		int iW = image.getWidth();
		int iH = image.getHeight();
		int pW = this.getWidth();
		int pH = this.getHeight();
		float newW, newH;
		
		float iratio= (float) iW / iH;
		float fratio= (float) pW / pH;
		
	
		if (iratio > fratio)  // image is proportionally wider than panel
		{
			newW = pW;  // find the width to the fit the panel
			newH = iH *  ((float) pW / iW);  // shorten by same proportion as width
		} else {  // image is proortionally taller than the panel
			newH= pH;  
			newW = iW *  ((float) pH / iH);  
		}
		
    if (!g.drawImage(image, 0, 0, Math.round(newW), Math.round(newH), null))
			 log.info("draw failed");	
  } 

  public static void showSlides(Images images) 
  { 
    frame.add(new Gui());
    frame.setSize(500, 400); 
		//frame.addComponentListener();
		image=images.getImage();
    frame.setVisible(true); 
  } 
}
